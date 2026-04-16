import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { events } from "@/lib/events";
import { transitionBreakdownSchema } from "@/lib/validations/breakdown";
import {
  transitionBreakdown,
  ServiceError,
} from "@/lib/services/breakdown-service";
import { BreakdownStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import type { Role } from "@/lib/tenant/context";
import { writeAuditLog } from "@/lib/services/audit-service";

type RouteParams = { params: Promise<{ id: string }> };

// Roles allowed for each target status
const TRANSITION_ROLES: Record<BreakdownStatus, Role[]> = {
  OPEN: [],
  ASSIGNED: ["ENGINEER", "FACTORY_ADMIN"],
  IN_PROGRESS: ["TECHNICIAN", "ENGINEER", "FACTORY_ADMIN"],
  WAITING_PARTS: ["TECHNICIAN"],
  RESOLVED: ["TECHNICIAN"],
  CLOSED: ["ENGINEER", "FACTORY_ADMIN"],
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      const { id } = await params;

      const body: unknown = await req.json();
      const parsed = transitionBreakdownSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { status: toStatus, ...extra } = parsed.data;

      // Look up current breakdown first to apply role + assignee checks
      const current = await withFactoryTx((tx) =>
        tx.breakdown.findUnique({
          where: { id },
          select: { id: true, status: true, assigneeId: true },
        }),
      );

      if (!current) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      // Role check for this specific transition
      const allowedRoles = TRANSITION_ROLES[toStatus];
      if (
        ctx.role !== "SUPER_ADMIN" &&
        !allowedRoles.includes(ctx.role as Role)
      ) {
        return NextResponse.json(
          { error: "forbidden", message: `Role ${ctx.role} cannot transition to ${toStatus}` },
          { status: 403 },
        );
      }

      // ASSIGNED → IN_PROGRESS: only the assignee (technician) can start
      if (
        current.status === BreakdownStatus.ASSIGNED &&
        toStatus === BreakdownStatus.IN_PROGRESS &&
        ctx.role === "TECHNICIAN" &&
        current.assigneeId !== ctx.userId
      ) {
        return NextResponse.json(
          { error: "forbidden", message: "Only the assigned technician can start this breakdown" },
          { status: 403 },
        );
      }

      let updated;
      try {
        updated = await withFactoryTx((tx) =>
          transitionBreakdown(
            tx,
            id,
            toStatus,
            ctx.userId,
            ctx.factoryId!,
            extra,
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

      const now = new Date().toISOString();

      // Emit breakdown.assigned when assigning
      if (toStatus === BreakdownStatus.ASSIGNED && extra.assigneeId) {
        await events.publish({
          id: randomUUID(),
          type: "breakdown.assigned",
          factoryId: ctx.factoryId ?? null,
          actorId: ctx.userId,
          occurredAt: now,
          breakdownId: id,
          assigneeId: extra.assigneeId,
        });
      }

      await events.publish({
        id: randomUUID(),
        type: "breakdown.status_changed",
        factoryId: ctx.factoryId ?? null,
        actorId: ctx.userId,
        occurredAt: now,
        breakdownId: id,
        fromStatus: current.status,
        toStatus,
      });

      void writeAuditLog({
        action: "TRANSITION",
        entityType: "breakdown",
        entityId: id,
        metadata: { fromStatus: current.status, toStatus },
      });

      return NextResponse.json(updated);
    },
  );
}
