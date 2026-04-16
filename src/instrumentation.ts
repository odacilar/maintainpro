/**
 * Next.js instrumentation hook (next.config → instrumentationHook: true required in Next 14).
 *
 * This runs once when the Next.js server boots (both dev and prod). We use it to
 * start the in-process scheduler in development. In production, the function is
 * a no-op — scheduling is driven by AWS EventBridge hitting /api/cron/* endpoints.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only import scheduler on the Node.js runtime (not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initScheduler } = await import("@/lib/scheduler/init");
    initScheduler();
  }
}
