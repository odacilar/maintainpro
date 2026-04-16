import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";

/**
 * GET /api/dashboard/mtbf?days=30
 * Mean Time Between Failures.
 * Simplification per spec: assume 24h continuous operation.
 *   MTBF = (machineCount * 24 * days) / breakdownCount  (hours)
 * Trend is grouped by ISO week.
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

      const [machineCount, breakdowns] = await withFactoryTx((tx) =>
        Promise.all([
          tx.machine.count(),
          tx.breakdown.findMany({
            where: {
              reportedAt: { gte: periodStart },
            },
            select: { reportedAt: true },
          }),
        ]),
      );

      const totalBreakdowns = breakdowns.length;
      const totalOperationalHours = machineCount * 24 * days;

      const averageHours =
        totalBreakdowns > 0
          ? Math.round((totalOperationalHours / totalBreakdowns) * 10) / 10
          : totalOperationalHours; // no breakdowns → infinite; cap at total period

      // Group breakdowns by ISO week for trend
      const byWeek = new Map<string, number>();

      for (const b of breakdowns) {
        const weekKey = getISOWeek(b.reportedAt);
        byWeek.set(weekKey, (byWeek.get(weekKey) ?? 0) + 1);
      }

      // Calculate MTBF per week (7 days, full machine fleet)
      const weeklyOperationalHours = machineCount * 24 * 7;

      const trend = Array.from(byWeek.entries())
        .map(([week, count]) => ({
          week,
          avgHours:
            count > 0
              ? Math.round((weeklyOperationalHours / count) * 10) / 10
              : weeklyOperationalHours,
        }))
        .sort((a, b) => a.week.localeCompare(b.week));

      return NextResponse.json({ averageHours, trend });
    },
  );
}

/** Returns an ISO week label like "2026-W07" for the given date. */
function getISOWeek(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // ISO week: week containing the first Thursday of the year
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
