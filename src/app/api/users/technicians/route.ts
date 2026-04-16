import { NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";

export async function GET() {
  return withApiTenant(
    { roles: ["ENGINEER", "FACTORY_ADMIN"] },
    async () => {
      const technicians = await withFactoryTx((tx) =>
        tx.user.findMany({
          where: { role: "TECHNICIAN" },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        }),
      );

      return NextResponse.json(technicians);
    },
  );
}
