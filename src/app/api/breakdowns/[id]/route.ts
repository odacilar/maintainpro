import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { id } = await params;

      const breakdown = await withFactoryTx((tx) =>
        tx.breakdown.findUnique({
          where: { id },
          include: {
            machine: {
              select: {
                id: true,
                name: true,
                code: true,
                department: { select: { id: true, name: true } },
              },
            },
            reporter: { select: { id: true, name: true, email: true } },
            assignee: { select: { id: true, name: true, email: true } },
            timeline: {
              include: {
                user: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        }),
      );

      if (!breakdown) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      return NextResponse.json(breakdown);
    },
  );
}
