/**
 * IndexedDB wrapper for MaintainPro offline support.
 *
 * Stores:
 *   "cache"           — key-value API response cache with optional TTL
 *   "pending-actions" — offline mutations queued for replay on reconnect
 */

const DB_NAME = "maintainpro-offline";
const DB_VERSION = 1;
const STORE_CACHE = "cache";
const STORE_PENDING = "pending-actions";

export interface PendingAction {
  id?: number;
  url: string;
  method: string;
  body: unknown;
  headers?: Record<string, string>;
  timestamp: number;
}

interface CacheEntry {
  key: string;
  data: unknown;
  expiresAt: number | null; // null = no expiry
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Cache API
// ---------------------------------------------------------------------------

/**
 * Retrieve a cached API response. Returns null if missing or expired.
 */
export async function getCachedResponse(key: string): Promise<unknown | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CACHE, "readonly");
    const store = tx.objectStore(STORE_CACHE);
    const entry = await promisify<CacheEntry | undefined>(store.get(key));

    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      // Expired — clean up asynchronously
      void deleteCachedResponse(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Store an API response in the cache.
 * @param ttlMs  Time-to-live in milliseconds. Omit for no expiry.
 */
export async function setCachedResponse(
  key: string,
  data: unknown,
  ttlMs?: number
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CACHE, "readwrite");
    const store = tx.objectStore(STORE_CACHE);
    const entry: CacheEntry = {
      key,
      data,
      expiresAt: ttlMs != null ? Date.now() + ttlMs : null,
    };
    await promisify(store.put(entry));
  } catch {
    // Silently ignore — cache is best-effort
  }
}

async function deleteCachedResponse(key: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CACHE, "readwrite");
    await promisify(tx.objectStore(STORE_CACHE).delete(key));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Pending actions (offline mutation queue)
// ---------------------------------------------------------------------------

/**
 * Enqueue a mutation to be replayed when the device comes back online.
 */
export async function addPendingAction(
  action: Omit<PendingAction, "id" | "timestamp">
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PENDING, "readwrite");
    await promisify(
      tx.objectStore(STORE_PENDING).add({ ...action, timestamp: Date.now() })
    );
  } catch {
    // ignore
  }
}

/**
 * Return all queued pending actions in insertion order.
 */
export async function getPendingActions(): Promise<PendingAction[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PENDING, "readonly");
    const result = await promisify<PendingAction[]>(
      tx.objectStore(STORE_PENDING).getAll()
    );
    return result ?? [];
  } catch {
    return [];
  }
}

/**
 * Remove a pending action after it has been successfully replayed.
 */
export async function removePendingAction(id: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PENDING, "readwrite");
    await promisify(tx.objectStore(STORE_PENDING).delete(id));
  } catch {
    // ignore
  }
}
