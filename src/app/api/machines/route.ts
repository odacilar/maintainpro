import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { events } from "@/lib/events";
import { createMachineSchema } from "@/lib/validations/machine";
import { MachineCriticality, MachineStatus, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { checkSubscriptionLimit } from "@/lib/auth/subscription-guard";
import { writeAuditLog } from "@/lib/services/audit-service";

export async function GET(req: NextRequest) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { searchParams } = req.nextUrl;
      const departmentId = searchParams.get("departmentId") ?? undefined;
      const status = searchParams.get("status") as MachineStatus | null;
      const criticality = searchParams.get(
        "criticality",
      ) as MachineCriticality | null;
      const search = searchParams.get("search") ?? undefined;

      const where: Prisma.MachineWhereInput = {};
      if (departmentId) where.departmentId = departmentId;
      if (status && Object.values(MachineStatus).includes(status)) {
        where.status = status;
      }
      if (
        criticality &&
        Object.values(MachineCriticality).includes(criticality)
      ) {
        where.criticality = criticality;
      }
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ];
      }

      const machines = await withFactoryTx((tx) =>
        tx.machine.findMany({
          where,
          include: { department: { select: { id: true, name: true } } },
          orderBy: { code: "asc" },
        }),
      );

      return NextResponse.json(machines);
    },
  );
}

export async function POST(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async (ctx) => {
      const body: unknown = await req.json();
      const parsed = createMachineSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      // Enforce subscription machine limit before creating.
      const limitCheck = await checkSubscriptionLimit(ctx.factoryId!, "machines");
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: `Abonelik limitinize ulaştınız. Maksimum ${limitCheck.max} makine ekleyebilirsiniz (mevcut: ${limitCheck.current}). Planınızı yükseltmek için yöneticinizle iletişime geçin.`,
          },
          { status: 403 },
        );
      }

      const codeConflict = await withFactoryTx((tx) =>
        tx.machine.findFirst({ where: { code: parsed.data.code } }),
      );
      if (codeConflict) {
        return NextResponse.json(
          { error: "machine_code_conflict" },
          { status: 409 },
        );
      }

      const machine = await withFactoryTx((tx) =>
        tx.machine.create({
          data: { ...parsed.data, qrToken: randomUUID(), factoryId: ctx.factoryId! },
          include: { department: { select: { id: true, name: true } } },
        }),
      );

      await events.publish({
        id: randomUUID(),
        type: "machine.created",
        factoryId: ctx.factoryId ?? null,
        actorId: ctx.userId,
        occurredAt: new Date().toISOString(),
        machineId: machine.id,
      });

      void writeAuditLog({
        action: "CREATE",
        entityType: "machine",
        entityId: machine.id,
        entityName: `${machine.code} — ${machine.name}`,
      });

      return NextResponse.json(machine, { status: 201 });
    },
  );
}
