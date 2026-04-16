import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";

/**
 * GET /api/dashboard/breakdown-types?days=30
 * Breakdown count grouped by BreakdownType for the given period.
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

      const groups = await withFactoryTx((tx) =>
        tx.breakdown.groupBy({
          by: ["type"],
          where: {
            reportedAt: { gte: periodStart },
          },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
        }),
      );

      const data = groups.map((g) => ({
        type: g.type,
        count: g._count.id,
      }));

      return NextResponse.json({ data });
    },
  );
}
