import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { events } from "@/lib/events";
import { createWorkOrderSchema } from "@/lib/validations/pm-plan";
import { ServiceError } from "@/lib/services/pm-service";
import { WorkOrderStatus, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { writeAuditLog } from "@/lib/services/audit-service";

export async function GET(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { searchParams } = req.nextUrl;
      const status = searchParams.get("status") as WorkOrderStatus | null;
      const machineId = searchParams.get("machineId") ?? undefined;
      const assigneeId = searchParams.get("assigneeId") ?? undefined;
      const pmPlanId = searchParams.get("pmPlanId") ?? undefined;
      const dateFrom = searchParams.get("dateFrom") ?? undefined;
      const dateTo = searchParams.get("dateTo") ?? undefined;

      const where: Prisma.WorkOrderWhereInput = {};

      if (status && Object.values(WorkOrderStatus).includes(status)) {
        where.status = status;
      }
      if (machineId) where.machineId = machineId;
      if (assigneeId) where.assigneeId = assigneeId;
      if (pmPlanId) where.pmPlanId = pmPlanId;
      if (dateFrom || dateTo) {
        where.scheduledFor = {};
        if (dateFrom) where.scheduledFor.gte = new Date(dateFrom);
        if (dateTo) where.scheduledFor.lte = new Date(dateTo);
      }

      const workOrders = await withFactoryTx((tx) =>
        tx.workOrder.findMany({
          where,
          include: {
            machine: { select: { id: true, name: true, code: true } },
            assignee: { select: { id: true, name: true } },
            pmPlan: { select: { id: true, name: true } },
          },
          orderBy: { scheduledFor: "asc" },
        }),
      );

      return NextResponse.json(workOrders);
    },
  );
}

export async function POST(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async (ctx) => {
      const body: unknown = await req.json();
      const parsed = createWorkOrderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { machineId, pmPlanId, scheduledDate, assigneeId, notes } =
        parsed.data;

      let workOrder;
      try {
        workOrder = await withFactoryTx(async (tx) => {
          // Verify machine exists (scoped by RLS)
          const machine = await tx.machine.findUnique({
            where: { id: machineId },
            select: { id: true },
          });
          if (!machine) {
            throw new ServiceError("not_found", "Machine not found");
          }

          // If pmPlanId given, verify it exists and belongs to same machine
          if (pmPlanId) {
            const plan = await tx.pmPlan.findUnique({
              where: { id: pmPlanId },
              select: { id: true, machineId: true },
            });
            if (!plan) {
              throw new ServiceError("not_found", "PM plan not found");
            }
            if (plan.machineId !== machineId) {
              throw new ServiceError(
                "validation_error",
                "PM plan does not belong to the specified machine",
              );
            }
          }

          return tx.workOrder.create({
            data: {
              factoryId: ctx.factoryId!,
              machineId,
              pmPlanId: pmPlanId ?? null,
              scheduledFor: new Date(scheduledDate),
              assigneeId: assigneeId ?? null,
              notes: notes ?? null,
              status: WorkOrderStatus.PLANNED,
            },
          });
        });
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

      await events.publish({
        id: randomUUID(),
        type: "workorder.created",
        factoryId: ctx.factoryId ?? null,
        actorId: ctx.userId,
        occurredAt: new Date().toISOString(),
        workOrderId: workOrder.id,
        machineId: workOrder.machineId,
        pmPlanId: workOrder.pmPlanId ?? null,
      });

      void writeAuditLog({
        action: "CREATE",
        entityType: "work_order",
        entityId: workOrder.id,
        metadata: {
          machineId: workOrder.machineId,
          pmPlanId: workOrder.pmPlanId,
          scheduledFor: workOrder.scheduledFor,
        },
      });

      return NextResponse.json(workOrder, { status: 201 });
    },
  );
}
