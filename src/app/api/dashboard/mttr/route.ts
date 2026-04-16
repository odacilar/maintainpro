import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";

/**
 * GET /api/dashboard/mttr?days=30
 * Mean Time To Repair — average minutes from reportedAt to resolvedAt,
 * broken down by day over the requested period.
 * Roles: FACTORY_ADMIN, ENGINEER
 */
export async function GET(req: NextRequest): Promise<Response> {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async () => {
      const { searchParams } = req.nextUrl;
      const days = Math.max(1, parseInt(searchParams.get("days") ?? "30", 10));

      const now = new Date();
      const periodStart = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - days + 1,
        ),
      );

      // Fetch all resolved/closed breakdowns in the period that have both timestamps
      const breakdowns = await withFactoryTx((tx) =>
        tx.breakdown.findMany({
          where: {
            status: { in: ["RESOLVED", "CLOSED"] },
            resolvedAt: { gte: periodStart },
          },
          select: {
            reportedAt: true,
            resolvedAt: true,
          },
        }),
      );

      // Group by UTC date string (YYYY-MM-DD)
      const byDay = new Map<string, number[]>();

      for (const b of breakdowns) {
        if (!b.resolvedAt) continue;
        const diffMinutes =
          (b.resolvedAt.getTime() - b.reportedAt.getTime()) / 60_000;
        if (diffMinutes < 0) continue; // guard against bad data

        const dateKey = b.resolvedAt.toISOString().slice(0, 10);
        const existing = byDay.get(dateKey);
        if (existing) {
          existing.push(diffMinutes);
        } else {
          byDay.set(dateKey, [diffMinutes]);
        }
      }

      // Build ordered trend array — one entry per day, even if no data (skip empties)
      const trend = Array.from(byDay.entries())
        .map(([date, values]) => ({
          date,
          avgMinutes:
            Math.round(
              (values.reduce((s, v) => s + v, 0) / values.length) * 10,
            ) / 10,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const allMinutes = breakdowns
        .filter((b) => b.resolvedAt !== null)
        .map((b) => (b.resolvedAt!.getTime() - b.reportedAt.getTime()) / 60_000)
        .filter((m) => m >= 0);

      const averageMinutes =
        allMinutes.length > 0
          ? Math.round(
              (allMinutes.reduce((s, v) => s + v, 0) / allMinutes.length) * 10,
            ) / 10
          : 0;

      return NextResponse.json({ averageMinutes, trend });
    },
  );
}
