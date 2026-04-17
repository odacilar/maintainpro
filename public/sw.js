const CACHE_NAME = 'maintainpro-v2';
const SHELL_URLS = ['/', '/panel', '/giris'];

// API routes whose GET responses we cache (stale-while-revalidate)
const API_CACHE_PATTERNS = [
  /^\/api\/machines/,
  /^\/api\/breakdowns/,
  /^\/api\/spare-parts/,
  /^\/api\/checklists/,
  /^\/api\/actions/,
  /^\/api\/notifications/,
  /^\/api\/pm/,
];

// IndexedDB config (mirrored from src/lib/offline/indexed-db.ts)
const IDB_NAME = 'maintainpro-offline';
const IDB_VERSION = 1;
const STORE_PENDING = 'pending-actions';

// ---------------------------------------------------------------------------
// Install & activate
// ---------------------------------------------------------------------------

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// IndexedDB helpers (service worker context — no module imports available)
// ---------------------------------------------------------------------------

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueOfflineMutation(request) {
  let body = null;
  try {
    body = await request.clone().json();
  } catch {
    // Non-JSON body — store as null
  }
  const db = await openIDB();
  const tx = db.transaction(STORE_PENDING, 'readwrite');
  tx.objectStore(STORE_PENDING).add({
    url: request.url,
    method: request.method,
    body,
    timestamp: Date.now(),
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

// ---------------------------------------------------------------------------
// FCM Push notifications (background)
// ---------------------------------------------------------------------------

self.addEventListener('push', (e) => {
  let data = { title: 'MaintainPro', body: 'Yeni bildirim' };
  try {
    if (e.data) data = e.data.json();
  } catch {
    // Non-JSON push payload
  }
  const { title, body, icon, url, ...rest } = data;
  e.waitUntil(
    self.registration.showNotification(title || 'MaintainPro', {
      body: body || '',
      icon: icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { url: url || '/panel' },
      ...rest,
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/panel';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

// ---------------------------------------------------------------------------
// Fetch handler
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only intercept same-origin requests
  if (url.origin !== self.location.origin) return;

  // -----------------------------------------------------------------------
  // Mutations (POST / PUT / DELETE / PATCH)
  // -----------------------------------------------------------------------
  if (request.method !== 'GET') {
    // Try network; if offline, queue to IndexedDB and return 202-like response
    e.respondWith(
      fetch(request.clone()).catch(async () => {
        try {
          await enqueueOfflineMutation(request);
        } catch {
          // IDB write failed — ignore
        }
        return new Response(
          JSON.stringify({ queued: true, message: 'Çevrimdışı: istek kuyruğa alındı' }),
          {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // -----------------------------------------------------------------------
  // GET: API routes — stale-while-revalidate via Cache API
  // -----------------------------------------------------------------------
  const isApiRoute = API_CACHE_PATTERNS.some((p) => p.test(url.pathname));

  if (isApiRoute) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request.clone())
          .then((response) => {
            if (response.ok) {
              // Clone before consuming — cache the clone
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached ?? new Response('{"error":"offline"}', {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }));

        // Return cached immediately if available; network updates cache in background
        return cached ?? networkFetch;
      })
    );
    return;
  }

  // -----------------------------------------------------------------------
  // GET: Shell / navigation — network-first, fall back to cache
  // -----------------------------------------------------------------------
  e.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
