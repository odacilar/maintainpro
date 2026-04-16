/**
 * POST /api/cron/pm-generate
 *
 * External cron endpoint for generating PM work orders for all factories.
 * Protected by CRON_SECRET env var — caller must pass:
 *   Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server";
import { runPmWorkOrderGeneration } from "@/lib/services/scheduler-service";

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
    const result = await runPmWorkOrderGeneration();
    console.log(`[cron/pm-generate] created=${result.created}`);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/pm-generate] error:", err);
    return NextResponse.json(
      { error: "internal_error", message: String(err) },
      { status: 500 },
    );
  }
}
