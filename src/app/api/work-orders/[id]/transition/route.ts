import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { events } from "@/lib/events";
import { transitionWorkOrderSchema } from "@/lib/validations/pm-plan";
import {
  transitionWorkOrder,
  ServiceError,
} from "@/lib/services/pm-service";
import { WorkOrderStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import type { Role } from "@/lib/tenant/context";
import { writeAuditLog } from "@/lib/services/audit-service";

type RouteParams = { params: Promise<{ id: string }> };

// Roles permitted to trigger each target status
const TRANSITION_ROLES: Record<WorkOrderStatus, Role[]> = {
  PLANNED: [],
  IN_PROGRESS: ["TECHNICIAN", "ENGINEER", "FACTORY_ADMIN"],
  COMPLETED: ["TECHNICIAN", "ENGINEER", "FACTORY_ADMIN"],
  CANCELLED: ["FACTORY_ADMIN", "ENGINEER"],
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      const { id } = await params;

      const body: unknown = await req.json();
      const parsed = transitionWorkOrderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { status: toStatus, notes } = parsed.data;

      // Fetch current state first for role check
      const current = await withFactoryTx((tx) =>
        tx.workOrder.findUnique({
          where: { id },
          select: { id: true, status: true, assigneeId: true },
        }),
      );

      if (!current) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      // Role-level guard per target status
      const allowedRoles = TRANSITION_ROLES[toStatus];
      if (
        ctx.role !== "SUPER_ADMIN" &&
        !allowedRoles.includes(ctx.role as Role)
      ) {
        return NextResponse.json(
          {
            error: "forbidden",
            message: `Role ${ctx.role} cannot transition to ${toStatus}`,
          },
          { status: 403 },
        );
      }

      // Technicians can only start their own assigned work orders
      if (
        toStatus === WorkOrderStatus.IN_PROGRESS &&
        ctx.role === "TECHNICIAN" &&
        current.assigneeId &&
        current.assigneeId !== ctx.userId
      ) {
        return NextResponse.json(
          {
            error: "forbidden",
            message: "Only the assigned technician can start this work order",
          },
          { status: 403 },
        );
      }

      let updated;
      try {
        updated = await withFactoryTx((tx) =>
          transitionWorkOrder(
            tx,
            id,
            toStatus,
            ctx.userId,
            ctx.factoryId!,
            { notes },
          ),
        );
      } catch (err) {
        if (err instanceof ServiceError) {
          const statusCode =
            err.code === "not_found"
              ? 404
              : err.code === "invalid_transition"
                ? 422
                : 400;
          return NextResponse.json(
            { error: err.code, message: err.message },
            { status: statusCode },
          );
        }
        throw err;
      }

      await events.publish({
        id: randomUUID(),
        type: "workorder.status_changed",
        factoryId: ctx.factoryId ?? null,
        actorId: ctx.userId,
        occurredAt: new Date().toISOString(),
        workOrderId: id,
        fromStatus: current.status,
        toStatus,
      });

      void writeAuditLog({
        action: "TRANSITION",
        entityType: "work_order",
        entityId: id,
        metadata: { fromStatus: current.status, toStatus },
      });

      return NextResponse.json(updated);
    },
  );
}
