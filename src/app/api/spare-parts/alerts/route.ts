import { NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";

export async function GET() {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async () => {
      const spareParts = await withFactoryTx((tx) =>
        tx.sparePart.findMany({
          include: {
            _count: { select: { stockMovements: true } },
          },
          orderBy: { name: "asc" },
        }),
      );

      // Filter parts at or below minimum stock and sort by shortage severity
      // (minimumStock - currentStock) desc = most critical first
      const alerts = spareParts
        .filter((p) => p.currentStock <= p.minimumStock)
        .sort(
          (a, b) =>
            b.minimumStock - b.currentStock - (a.minimumStock - a.currentStock),
        )
        .map((p) => ({
          ...p,
          shortage: p.minimumStock - p.currentStock,
        }));

      return NextResponse.json(alerts);
    },
  );
}
