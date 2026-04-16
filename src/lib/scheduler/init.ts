/**
 * Scheduler initialisation entry point.
 *
 * Call `initScheduler()` once at app startup. In development, this starts the
 * in-process dev-scheduler. In production, scheduling is handled externally
 * (AWS EventBridge → POST /api/cron/*) and this is a no-op.
 */

import { start } from "./dev-scheduler";

let initialised = false;

export function initScheduler(): void {
  if (initialised) return;
  initialised = true;

  if (process.env.NODE_ENV === "development") {
    start();
  }
}
