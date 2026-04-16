import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { events } from "@/lib/events";
import { transitionActionSchema } from "@/lib/validations/checklist";
import {
  transitionAction,
  ServiceError,
} from "@/lib/services/checklist-service";
import { ActionStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import type { Role } from "@/lib/tenant/context";

type RouteParams = { params: Promise<{ id: string }> };

// Roles permitted to drive each target status (spec §6)
const TRANSITION_ROLES: Record<ActionStatus, Role[]> = {
  OPEN: [],
  IN_PROGRESS: ["TECHNICIAN"],
  COMPLETED: ["TECHNICIAN"],
  VERIFIED: ["ENGINEER", "FACTORY_ADMIN"],
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      const { id } = await params;

      const body: unknown = await req.json();
      const parsed = transitionActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { status: toStatus, ...extra } = parsed.data;

      // Role gate for this specific transition
      const allowedRoles = TRANSITION_ROLES[toStatus];
      if (!allowedRoles.includes(ctx.role as Role)) {
        return NextResponse.json(
          {
            error: "forbidden",
            message: `Role ${ctx.role} cannot transition an action to ${toStatus}`,
          },
          { status: 403 },
        );
      }

      // For IN_PROGRESS: only the assignee (technician) may start it
      if (toStatus === ActionStatus.IN_PROGRESS && ctx.role === "TECHNICIAN") {
        const current = await withFactoryTx((tx) =>
          tx.action.findUnique({
            where: { id },
            select: { assigneeId: true },
          }),
        );

        if (current && current.assigneeId && current.assigneeId !== ctx.userId) {
          return NextResponse.json(
            {
              error: "forbidden",
              message: "Only the assigned technician can start this action",
            },
            { status: 403 },
          );
        }
      }

      let updated;
      try {
        updated = await withFactoryTx((tx) =>
          transitionAction(
            tx,
            id,
            toStatus,
            ctx.userId,
            ctx.factoryId!,
            {
              resolutionNotes: extra.resolutionNotes,
              assigneeId: extra.assigneeId,
              targetDate: extra.targetDate,
            },
          ),
        );
      } catch (err) {
        if (err instanceof ServiceError) {
          const status =
            err.code === "not_found"
              ? 404
              : err.code === "invalid_transition"
                ? 422
                : 400;
          return NextResponse.json(
            { error: err.code, message: err.message },
            { status },
          );
        }
        throw err;
      }

      await events.publish({
        id: randomUUID(),
        type: "action.status_changed",
        factoryId: ctx.factoryId ?? null,
        actorId: ctx.userId,
        occurredAt: new Date().toISOString(),
        actionId: id,
        toStatus,
      });

      return NextResponse.json(updated);
    },
  );
}
