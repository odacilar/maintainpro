/**
 * POST /api/cron/escalation
 *
 * External cron endpoint for breakdown escalation.
 * Protected by CRON_SECRET env var — caller must pass:
 *   Authorization: Bearer {CRON_SECRET}
 *
 * Invoke via AWS EventBridge Scheduler or Vercel Cron.
 */

import { NextRequest, NextResponse } from "next/server";
import { runBreakdownEscalation } from "@/lib/services/scheduler-service";

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // In development, allow unauthenticated calls for convenience
    return process.env.NODE_ENV === "development";
  }
  const authHeader = req.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBreakdownEscalation();
    console.log(`[cron/escalation] escalated=${result.escalated}`);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/escalation] error:", err);
    return NextResponse.json(
      { error: "internal_error", message: String(err) },
      { status: 500 },
    );
  }
}
