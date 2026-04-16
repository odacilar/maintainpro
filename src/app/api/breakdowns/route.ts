import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { events } from "@/lib/events";
import { createBreakdownSchema } from "@/lib/validations/breakdown";
import { createBreakdown, ServiceError } from "@/lib/services/breakdown-service";
import { BreakdownStatus, BreakdownPriority, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { writeAuditLog } from "@/lib/services/audit-service";

export async function GET(req: NextRequest) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { searchParams } = req.nextUrl;
      const status = searchParams.get("status") as BreakdownStatus | null;
      const priority = searchParams.get("priority") as BreakdownPriority | null;
      const machineId = searchParams.get("machineId") ?? undefined;
      const departmentId = searchParams.get("departmentId") ?? undefined;
      const search = searchParams.get("search") ?? undefined;

      const where: Prisma.BreakdownWhereInput = {};

      if (status && Object.values(BreakdownStatus).includes(status)) {
        where.status = status;
      }
      if (priority && Object.values(BreakdownPriority).includes(priority)) {
        where.priority = priority;
      }
      if (machineId) where.machineId = machineId;
      if (departmentId) {
        where.machine = { departmentId };
      }
      if (search) {
        where.OR = [
          { code: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const breakdowns = await withFactoryTx((tx) =>
        tx.breakdown.findMany({
          where,
          include: {
            machine: { select: { id: true, name: true, code: true } },
            reporter: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
          },
          orderBy: { reportedAt: "desc" },
        }),
      );

      return NextResponse.json(breakdowns);
    },
  );
}

export async function POST(req: NextRequest) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      const body: unknown = await req.json();
      const parsed = createBreakdownSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      let breakdown;
      try {
        breakdown = await withFactoryTx((tx) =>
          createBreakdown(tx, parsed.data, ctx.userId, ctx.factoryId!),
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
        type: "breakdown.created",
        factoryId: ctx.factoryId ?? null,
        actorId: ctx.userId,
        occurredAt: new Date().toISOString(),
        breakdownId: breakdown.id,
        machineId: breakdown.machineId,
        priority: breakdown.priority,
      });

      void writeAuditLog({
        action: "CREATE",
        entityType: "breakdown",
        entityId: breakdown.id,
        entityName: breakdown.code,
      });

      return NextResponse.json(breakdown, { status: 201 });
    },
  );
}
