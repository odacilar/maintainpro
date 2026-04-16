import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";

/**
 * GET /api/dashboard/pareto?days=30&limit=10
 * Top machines by breakdown count (Pareto analysis).
 * Returns machines sorted descending by breakdown count with total downtime.
 * Roles: FACTORY_ADMIN, ENGINEER
 */
export async function GET(req: NextRequest): Promise<Response> {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async () => {
      const { searchParams } = req.nextUrl;
      const days = Math.max(1, parseInt(searchParams.get("days") ?? "30", 10));
      const limit = Math.max(
        1,
        Math.min(100, parseInt(searchParams.get("limit") ?? "10", 10)),
      );

      const now = new Date();
      const periodStart = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - days + 1,
        ),
      );

      // Fetch all breakdowns in period with machine details
      const breakdowns = await withFactoryTx((tx) =>
        tx.breakdown.findMany({
          where: {
            reportedAt: { gte: periodStart },
          },
          select: {
            machineId: true,
            totalDowntimeMinutes: true,
            machine: {
              select: { name: true, code: true },
            },
          },
        }),
      );

      // Aggregate by machineId
      const machineMap = new Map<
        string,
        {
          machineId: string;
          machineName: string;
          machineCode: string;
          count: number;
          totalDowntimeMinutes: number;
        }
      >();

      for (const b of breakdowns) {
        const existing = machineMap.get(b.machineId);
        if (existing) {
          existing.count += 1;
          existing.totalDowntimeMinutes += b.totalDowntimeMinutes ?? 0;
        } else {
          machineMap.set(b.machineId, {
            machineId: b.machineId,
            machineName: b.machine.name,
            machineCode: b.machine.code,
            count: 1,
            totalDowntimeMinutes: b.totalDowntimeMinutes ?? 0,
          });
        }
      }

      const data = Array.from(machineMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return NextResponse.json({ data });
    },
  );
}
