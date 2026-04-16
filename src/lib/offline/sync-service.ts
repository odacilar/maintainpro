/**
 * Offline sync service — replays pending mutations when the device comes back
 * online and registers the global online event listener.
 */

import { getPendingActions, removePendingAction } from "./indexed-db";

export interface SyncResult {
  synced: number;
  failed: number;
}

/**
 * Replay all queued pending actions against the server.
 * Actions are processed sequentially so that order is preserved.
 * Successfully replayed actions are removed from the queue.
 */
export async function syncPendingActions(): Promise<SyncResult> {
  const actions = await getPendingActions();
  let synced = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: {
          "Content-Type": "application/json",
          ...(action.headers ?? {}),
        },
        body:
          action.body != null ? JSON.stringify(action.body) : undefined,
      });

      if (response.ok) {
        await removePendingAction(action.id!);
        synced++;
      } else {
        // Server rejected the request — not a transient error, still remove
        // to avoid infinite retry loops; caller should handle via UI feedback.
        await removePendingAction(action.id!);
        failed++;
      }
    } catch {
      // Network still unavailable for this action — leave it in the queue.
      failed++;
    }
  }

  return { synced, failed };
}

let listenerRegistered = false;

/**
 * Register a global "online" event listener that triggers sync automatically.
 * Safe to call multiple times — listener is only registered once.
 */
export function startSyncListener(): void {
  if (typeof window === "undefined") return;
  if (listenerRegistered) return;

  listenerRegistered = true;

  window.addEventListener("online", () => {
    void syncPendingActions();
  });
}
