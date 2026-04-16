import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";

/**
 * GET /api/dashboard/department-downtime?days=30
 * Total downtime and breakdown count grouped by department.
 * Joins: breakdowns → machines → departments.
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

      const breakdowns = await withFactoryTx((tx) =>
        tx.breakdown.findMany({
          where: {
            reportedAt: { gte: periodStart },
          },
          select: {
            totalDowntimeMinutes: true,
            machine: {
              select: {
                department: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        }),
      );

      // Aggregate by departmentId
      const deptMap = new Map<
        string,
        {
          departmentId: string;
          department: string;
          totalMinutes: number;
          breakdownCount: number;
        }
      >();

      for (const b of breakdowns) {
        const dept = b.machine.department;
        const existing = deptMap.get(dept.id);
        if (existing) {
          existing.totalMinutes += b.totalDowntimeMinutes ?? 0;
          existing.breakdownCount += 1;
        } else {
          deptMap.set(dept.id, {
            departmentId: dept.id,
            department: dept.name,
            totalMinutes: b.totalDowntimeMinutes ?? 0,
            breakdownCount: 1,
          });
        }
      }

      const data = Array.from(deptMap.values()).sort(
        (a, b) => b.totalMinutes - a.totalMinutes,
      );

      return NextResponse.json({ data });
    },
  );
}
