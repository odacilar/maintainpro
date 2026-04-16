import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { updateWorkOrderSchema } from "@/lib/validations/pm-plan";
import { ServiceError } from "@/lib/services/pm-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { id } = await params;

      const workOrder = await withFactoryTx((tx) =>
        tx.workOrder.findUnique({
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
            assignee: { select: { id: true, name: true, email: true } },
            pmPlan: {
              select: {
                id: true,
                name: true,
                maintenanceType: true,
                taskList: true,
                estimatedDurationMinutes: true,
              },
            },
          },
        }),
      );

      if (!workOrder) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      return NextResponse.json(workOrder);
    },
  );
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { id } = await params;

      const body: unknown = await req.json();
      const parsed = updateWorkOrderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { notes, assigneeId } = parsed.data;

      try {
        const updated = await withFactoryTx(async (tx) => {
          const existing = await tx.workOrder.findUnique({ where: { id } });
          if (!existing) {
            throw new ServiceError("not_found", "Work order not found");
          }

          const updateData: Parameters<typeof tx.workOrder.update>[0]["data"] =
            {};

          if (notes !== undefined) updateData.notes = notes;
          if (assigneeId !== undefined) updateData.assigneeId = assigneeId;

          return tx.workOrder.update({ where: { id }, data: updateData });
        });

        return NextResponse.json(updated);
      } catch (err) {
        if (err instanceof ServiceError) {
          const status = err.code === "not_found" ? 404 : 422;
          return NextResponse.json(
            { error: err.code, message: err.message },
            { status },
          );
        }
        throw err;
      }
    },
  );
}
