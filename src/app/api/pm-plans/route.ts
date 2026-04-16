import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { events } from "@/lib/events";
import { createPmPlanSchema } from "@/lib/validations/pm-plan";
import { createPmPlan, ServiceError } from "@/lib/services/pm-service";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async () => {
      const { searchParams } = req.nextUrl;
      const machineId = searchParams.get("machineId") ?? undefined;
      const isActiveParam = searchParams.get("isActive");
      const frequency = searchParams.get("frequency") ?? undefined;

      const where: Prisma.PmPlanWhereInput = {};

      if (machineId) where.machineId = machineId;
      if (isActiveParam !== null) where.isActive = isActiveParam === "true";

      // frequency maps to intervalDays via FREQUENCY_INTERVAL_DAYS — filter by triggerType for now
      if (frequency) {
        // Store frequency as part of maintenanceType or intervalDays — filter by name match
        where.name = { contains: frequency, mode: "insensitive" };
      }

      const plans = await withFactoryTx((tx) =>
        tx.pmPlan.findMany({
          where,
          include: {
            machine: { select: { id: true, name: true, code: true } },
            workOrders: {
              where: { status: { in: ["COMPLETED"] } },
              orderBy: { completedAt: "desc" },
              take: 1,
              select: { completedAt: true },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      );

      // Attach assignee info — PmPlan has no direct assigneeId; workOrders carry it
      const result = plans.map((plan) => ({
        ...plan,
        lastExecutedAt: plan.workOrders[0]?.completedAt ?? plan.lastExecutedAt,
        workOrders: undefined,
      }));

      return NextResponse.json(result);
    },
  );
}

export async function POST(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async (ctx) => {
      const body: unknown = await req.json();
      const parsed = createPmPlanSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      let plan;
      try {
        plan = await withFactoryTx((tx) =>
          createPmPlan(tx, parsed.data, ctx.factoryId!),
        );
      } catch (err) {
        if (err instanceof ServiceError) {
          return NextResponse.json(
            { error: err.code, message: err.message },
            { status: 422 },
          );
        }
        throw err;
      }

      await events.publish({
        id: randomUUID(),
        type: "pmplan.created",
        factoryId: ctx.factoryId ?? null,
        actorId: ctx.userId,
        occurredAt: new Date().toISOString(),
        pmPlanId: plan.id,
        machineId: plan.machineId,
      });

      return NextResponse.json(plan, { status: 201 });
    },
  );
}
