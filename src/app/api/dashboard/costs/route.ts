import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * GET /api/dashboard/costs?days=30
 * Spare-parts cost summary: sum quantity * unitPriceSnapshot for OUT/SCRAP movements.
 * Compares current period vs the equal-length previous period.
 * Breakdown by department via: movement → machine → department.
 * Roles: FACTORY_ADMIN, ENGINEER
 */
export async function GET(req: NextRequest): Promise<Response> {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async () => {
      const { searchParams } = req.nextUrl;
      const days = Math.max(1, parseInt(searchParams.get("days") ?? "30", 10));

      const now = new Date();
      const currentEnd = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1, // exclusive upper bound (tomorrow 00:00)
        ),
      );
      const currentStart = new Date(
        currentEnd.getTime() - days * 24 * 60 * 60 * 1000,
      );
      const previousStart = new Date(
        currentStart.getTime() - days * 24 * 60 * 60 * 1000,
      );

      // OUT types that represent cost: BREAKDOWN_OUT, PM_OUT, SCRAP_OUT
      const outTypes = ["BREAKDOWN_OUT", "PM_OUT", "SCRAP_OUT"] as const;

      const [currentMovements, previousMovements] = await withFactoryTx((tx) =>
        Promise.all([
          tx.stockMovement.findMany({
            where: {
              type: { in: [...outTypes] },
              createdAt: { gte: currentStart, lt: currentEnd },
              unitPriceSnapshot: { not: null },
            },
            select: {
              quantity: true,
              unitPriceSnapshot: true,
              machine: {
                select: {
                  department: { select: { id: true, name: true } },
                },
              },
            },
          }),
          tx.stockMovement.findMany({
            where: {
              type: { in: [...outTypes] },
              createdAt: { gte: previousStart, lt: currentStart },
              unitPriceSnapshot: { not: null },
            },
            select: {
              quantity: true,
              unitPriceSnapshot: true,
            },
          }),
        ]),
      );

      /** Computes total cost (quantity * unitPriceSnapshot) for a movement list. */
      function sumCost(
        movements: { quantity: number; unitPriceSnapshot: Decimal | null }[],
      ): number {
        return movements.reduce((sum, m) => {
          if (!m.unitPriceSnapshot) return sum;
          return sum + m.quantity * Number(m.unitPriceSnapshot);
        }, 0);
      }

      const totalCost = Math.round(sumCost(currentMovements) * 100) / 100;
      const previousPeriodCost =
        Math.round(sumCost(previousMovements) * 100) / 100;

      const changePercent =
        previousPeriodCost > 0
          ? Math.round(
              ((totalCost - previousPeriodCost) / previousPeriodCost) * 1000,
            ) / 10
          : totalCost > 0
            ? 100
            : 0;

      // Group current period by department
      const deptMap = new Map<
        string,
        { departmentName: string; cost: number }
      >();

      for (const m of currentMovements) {
        if (!m.unitPriceSnapshot || !m.machine?.department) continue;
        const dept = m.machine.department;
        const lineCost = m.quantity * Number(m.unitPriceSnapshot);
        const existing = deptMap.get(dept.id);
        if (existing) {
          existing.cost += lineCost;
        } else {
          deptMap.set(dept.id, {
            departmentName: dept.name,
            cost: lineCost,
          });
        }
      }

      const byDepartment = Array.from(deptMap.values())
        .map((d) => ({
          departmentName: d.departmentName,
          cost: Math.round(d.cost * 100) / 100,
        }))
        .sort((a, b) => b.cost - a.cost);

      return NextResponse.json({
        totalCost,
        previousPeriodCost,
        changePercent,
        byDepartment,
      });
    },
  );
}
