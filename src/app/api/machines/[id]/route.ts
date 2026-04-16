import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { events } from "@/lib/events";
import { updateMachineSchema } from "@/lib/validations/machine";
import { randomUUID } from "crypto";
import { writeAuditLog, diffChanges } from "@/lib/services/audit-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { id } = await params;
      const machine = await withFactoryTx((tx) =>
        tx.machine.findUnique({
          where: { id },
          include: { department: { select: { id: true, name: true } } },
        }),
      );
      if (!machine) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      return NextResponse.json(machine);
    },
  );
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async (ctx) => {
      const { id } = await params;
      const body: unknown = await req.json();
      const parsed = updateMachineSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const existing = await withFactoryTx((tx) =>
        tx.machine.findUnique({ where: { id } }),
      );
      if (!existing) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      if (parsed.data.code && parsed.data.code !== existing.code) {
        const codeConflict = await withFactoryTx((tx) =>
          tx.machine.findFirst({ where: { code: parsed.data.code! } }),
        );
        if (codeConflict) {
          return NextResponse.json(
            { error: "machine_code_conflict" },
            { status: 409 },
          );
        }
      }

      const machine = await withFactoryTx((tx) =>
        tx.machine.update({
          where: { id },
          data: parsed.data,
          include: { department: { select: { id: true, name: true } } },
        }),
      );

      const statusChanged =
        parsed.data.status !== undefined &&
        parsed.data.status !== existing.status;

      if (statusChanged) {
        await events.publish({
          id: randomUUID(),
          type: "machine.status_changed",
          factoryId: ctx.factoryId ?? null,
          actorId: ctx.userId,
          occurredAt: new Date().toISOString(),
          machineId: machine.id,
          status: machine.status,
        });
      } else {
        await events.publish({
          id: randomUUID(),
          type: "machine.updated",
          factoryId: ctx.factoryId ?? null,
          actorId: ctx.userId,
          occurredAt: new Date().toISOString(),
          machineId: machine.id,
        });
      }

      void writeAuditLog({
        action: "UPDATE",
        entityType: "machine",
        entityId: machine.id,
        entityName: `${machine.code} — ${machine.name}`,
        changes: diffChanges(
          existing as unknown as Record<string, unknown>,
          machine as unknown as Record<string, unknown>,
        ),
      });

      return NextResponse.json(machine);
    },
  );
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  return withApiTenant({ roles: ["FACTORY_ADMIN"] }, async (ctx) => {
    const { id } = await params;

    const existing = await withFactoryTx((tx) =>
      tx.machine.findUnique({ where: { id } }),
    );
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const breakdownCount = await withFactoryTx((tx) =>
      tx.breakdown.count({ where: { machineId: id } }),
    );
    if (breakdownCount > 0) {
      return NextResponse.json(
        { error: "machine_has_breakdowns", count: breakdownCount },
        { status: 409 },
      );
    }

    await withFactoryTx((tx) => tx.machine.delete({ where: { id } }));

    // machine.deleted is not in the DomainEvent union — emit machine.updated as tombstone
    // TODO: add machine.deleted to DomainEvent types when needed
    await events.publish({
      id: randomUUID(),
      type: "machine.updated",
      factoryId: ctx.factoryId ?? null,
      actorId: ctx.userId,
      occurredAt: new Date().toISOString(),
      machineId: id,
    });

    void writeAuditLog({
      action: "DELETE",
      entityType: "machine",
      entityId: id,
      entityName: `${existing.code} — ${existing.name}`,
    });

    return new Response(null, { status: 204 });
  });
}
