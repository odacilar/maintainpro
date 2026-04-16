import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { updateDepartmentSchema } from "@/lib/validations/machine";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { id } = await params;
      const department = await withFactoryTx((tx) =>
        tx.department.findUnique({ where: { id } }),
      );
      if (!department) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      return NextResponse.json(department);
    },
  );
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return withApiTenant({ roles: ["FACTORY_ADMIN"] }, async () => {
    const { id } = await params;
    const body: unknown = await req.json();
    const parsed = updateDepartmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = await withFactoryTx((tx) =>
      tx.department.findUnique({ where: { id } }),
    );
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (parsed.data.code && parsed.data.code !== existing.code) {
      const codeConflict = await withFactoryTx((tx) =>
        tx.department.findFirst({ where: { code: parsed.data.code! } }),
      );
      if (codeConflict) {
        return NextResponse.json(
          { error: "department_code_conflict" },
          { status: 409 },
        );
      }
    }

    const updated = await withFactoryTx((tx) =>
      tx.department.update({ where: { id }, data: parsed.data }),
    );

    return NextResponse.json(updated);
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  return withApiTenant({ roles: ["FACTORY_ADMIN"] }, async () => {
    const { id } = await params;

    const existing = await withFactoryTx((tx) =>
      tx.department.findUnique({ where: { id } }),
    );
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const machineCount = await withFactoryTx((tx) =>
      tx.machine.count({ where: { departmentId: id } }),
    );
    if (machineCount > 0) {
      return NextResponse.json(
        { error: "department_has_machines", count: machineCount },
        { status: 409 },
      );
    }

    await withFactoryTx((tx) => tx.department.delete({ where: { id } }));

    return new Response(null, { status: 204 });
  });
}
