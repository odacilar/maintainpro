/**
 * POST /api/cron/missed-checklists
 *
 * External cron endpoint for marking overdue checklist records as "missed".
 * Protected by CRON_SECRET env var — caller must pass:
 *   Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server";
import { runMissedChecklistMarking } from "@/lib/services/scheduler-service";

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
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
    const result = await runMissedChecklistMarking();
    console.log(`[cron/missed-checklists] marked=${result.marked}`);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/missed-checklists] error:", err);
    return NextResponse.json(
      { error: "internal_error", message: String(err) },
      { status: 500 },
    );
  }
}
