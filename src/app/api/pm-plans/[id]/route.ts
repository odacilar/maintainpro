import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { updatePmPlanSchema } from "@/lib/validations/pm-plan";
import { ServiceError } from "@/lib/services/pm-service";
import { FREQUENCY_INTERVAL_DAYS } from "@/lib/validations/pm-plan";
import type { PmFrequency } from "@/lib/validations/pm-plan";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { id } = await params;

      const plan = await withFactoryTx((tx) =>
        tx.pmPlan.findUnique({
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
            workOrders: {
              include: {
                assignee: { select: { id: true, name: true } },
              },
              orderBy: { scheduledFor: "desc" },
              take: 20,
            },
          },
        }),
      );

      if (!plan) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      return NextResponse.json(plan);
    },
  );
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async () => {
      const { id } = await params;

      const body: unknown = await req.json();
      const parsed = updatePmPlanSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const data = parsed.data;

      try {
        const updated = await withFactoryTx(async (tx) => {
          const existing = await tx.pmPlan.findUnique({ where: { id } });
          if (!existing) {
            throw new ServiceError("not_found", "PM plan not found");
          }

          const updateFields: Parameters<typeof tx.pmPlan.update>[0]["data"] =
            {};

          if (data.title !== undefined) updateFields.name = data.title;
          if (data.isActive !== undefined) updateFields.isActive = data.isActive;
          if (data.estimatedMinutes !== undefined) {
            updateFields.estimatedDurationMinutes = data.estimatedMinutes;
          }
          if (data.frequency !== undefined) {
            updateFields.intervalDays =
              FREQUENCY_INTERVAL_DAYS[data.frequency as PmFrequency];
          }
          if (data.instructions !== undefined) {
            updateFields.taskList = data.instructions
              .split("\n")
              .map((l: string) => l.trim())
              .filter(Boolean);
          }
          if (data.description !== undefined || data.priority !== undefined) {
            const [, existingDesc] = existing.maintenanceType.split(":");
            const priority = data.priority ?? existing.maintenanceType.split(":")[0];
            const description = data.description ?? existingDesc ?? "";
            updateFields.maintenanceType = `${priority}:${description}`;
          }

          return tx.pmPlan.update({
            where: { id },
            data: updateFields,
          });
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

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  return withApiTenant({ roles: ["FACTORY_ADMIN"] }, async () => {
    const { id } = await params;

    try {
      await withFactoryTx(async (tx) => {
        const plan = await tx.pmPlan.findUnique({
          where: { id },
          select: { id: true, _count: { select: { workOrders: true } } },
        });

        if (!plan) {
          throw new ServiceError("not_found", "PM plan not found");
        }

        if (plan._count.workOrders > 0) {
          throw new ServiceError(
            "has_work_orders",
            "Cannot delete a PM plan that has existing work orders",
          );
        }

        await tx.pmPlan.delete({ where: { id } });
      });

      return new NextResponse(null, { status: 204 });
    } catch (err) {
      if (err instanceof ServiceError) {
        const status =
          err.code === "not_found"
            ? 404
            : err.code === "has_work_orders"
              ? 409
              : 422;
        return NextResponse.json(
          { error: err.code, message: err.message },
          { status },
        );
      }
      throw err;
    }
  });
}
