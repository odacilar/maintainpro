/**
 * Dev-mode in-process scheduler
 *
 * Only runs when NODE_ENV === "development". Calls the same scheduler functions
 * that the external cron endpoints call, so the behaviour in dev matches prod.
 *
 * Intervals:
 *  - Breakdown escalation : every 5 minutes
 *  - Missed checklists    : every 15 minutes
 *  - PM work orders       : every hour
 */

import {
  runBreakdownEscalation,
  runMissedChecklistMarking,
  runPmWorkOrderGeneration,
} from "@/lib/services/scheduler-service";

const FIVE_MINUTES = 5 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

let escalationTimer: ReturnType<typeof setInterval> | null = null;
let missedChecklistTimer: ReturnType<typeof setInterval> | null = null;
let pmGenerateTimer: ReturnType<typeof setInterval> | null = null;

async function safeRun<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<void> {
  try {
    const result = await fn();
    console.log(`[dev-scheduler] ${name}:`, result);
  } catch (err) {
    console.error(`[dev-scheduler] ${name} error:`, err);
  }
}

export function start(): void {
  if (process.env.NODE_ENV !== "development") return;
  if (escalationTimer) return; // already running

  console.log("[dev-scheduler] starting in-process scheduler (dev mode)");

  // Run immediately on startup, then on interval
  void safeRun("runBreakdownEscalation", runBreakdownEscalation);
  void safeRun("runMissedChecklistMarking", runMissedChecklistMarking);
  void safeRun("runPmWorkOrderGeneration", runPmWorkOrderGeneration);

  escalationTimer = setInterval(
    () => void safeRun("runBreakdownEscalation", runBreakdownEscalation),
    FIVE_MINUTES,
  );

  missedChecklistTimer = setInterval(
    () => void safeRun("runMissedChecklistMarking", runMissedChecklistMarking),
    FIFTEEN_MINUTES,
  );

  pmGenerateTimer = setInterval(
    () => void safeRun("runPmWorkOrderGeneration", runPmWorkOrderGeneration),
    ONE_HOUR,
  );
}

export function stop(): void {
  if (escalationTimer) {
    clearInterval(escalationTimer);
    escalationTimer = null;
  }
  if (missedChecklistTimer) {
    clearInterval(missedChecklistTimer);
    missedChecklistTimer = null;
  }
  if (pmGenerateTimer) {
    clearInterval(pmGenerateTimer);
    pmGenerateTimer = null;
  }
  console.log("[dev-scheduler] stopped");
}
