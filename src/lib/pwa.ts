/**
 * Registers the PWA service worker if the browser supports it.
 * Called once at app shell mount. Safe to call multiple times (idempotent).
 */
export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[PWA] Service worker registered:", registration.scope);
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          // New content is available — could show a toast here in the future
          if (process.env.NODE_ENV === "development") {
            console.log("[PWA] New service worker installed, update available.");
          }
        }
      });
    });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[PWA] Service worker registration failed:", err);
    }
  }
}
