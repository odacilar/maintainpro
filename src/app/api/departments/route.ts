import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { createDepartmentSchema } from "@/lib/validations/machine";

export async function GET() {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const departments = await withFactoryTx((tx) =>
        tx.department.findMany({ orderBy: { name: "asc" } }),
      );
      return NextResponse.json(departments);
    },
  );
}

export async function POST(req: NextRequest) {
  return withApiTenant({ roles: ["FACTORY_ADMIN"] }, async (ctx) => {
    const body: unknown = await req.json();
    const parsed = createDepartmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = await withFactoryTx((tx) =>
      tx.department.findFirst({ where: { code: parsed.data.code } }),
    );
    if (existing) {
      return NextResponse.json(
        { error: "department_code_conflict" },
        { status: 409 },
      );
    }

    const department = await withFactoryTx((tx) =>
      tx.department.create({ data: { ...parsed.data, factoryId: ctx.factoryId! } }),
    );

    return NextResponse.json(department, { status: 201 });
  });
}
