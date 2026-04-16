import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { events } from "@/lib/events";
import { createStockMovementSchema } from "@/lib/validations/spare-part";
import {
  createStockMovement,
  StockServiceError,
} from "@/lib/services/stock-service";
import { StockMovementType } from "@prisma/client";
import { randomUUID } from "crypto";
import type { Role } from "@/lib/tenant/context";

type Params = { params: Promise<{ id: string }> };

// Role permissions per movement type (spec §4 + task brief)
// PURCHASE_IN  → FACTORY_ADMIN, ENGINEER
// BREAKDOWN_OUT → FACTORY_ADMIN, ENGINEER, TECHNICIAN
// PM_OUT       → FACTORY_ADMIN, ENGINEER, TECHNICIAN
// RETURN_IN    → FACTORY_ADMIN, ENGINEER, TECHNICIAN
// ADJUSTMENT   → FACTORY_ADMIN only
// SCRAP_OUT    → FACTORY_ADMIN, ENGINEER
const ALLOWED_ROLES_BY_TYPE: Record<StockMovementType, Role[]> = {
  [StockMovementType.PURCHASE_IN]: ["FACTORY_ADMIN", "ENGINEER"],
  [StockMovementType.BREAKDOWN_OUT]: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"],
  [StockMovementType.PM_OUT]: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"],
  [StockMovementType.RETURN_IN]: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"],
  [StockMovementType.ADJUSTMENT]: ["FACTORY_ADMIN"],
  [StockMovementType.SCRAP_OUT]: ["FACTORY_ADMIN", "ENGINEER"],
};

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: sparePartId } = await params;
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const sparePart = await withFactoryTx((tx) =>
        tx.sparePart.findUnique({ where: { id: sparePartId } }),
      );
      if (!sparePart) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      const movements = await withFactoryTx((tx) =>
        tx.stockMovement.findMany({
          where: { sparePartId },
          include: {
            user: { select: { id: true, name: true } },
            machine: { select: { id: true, name: true, code: true } },
            breakdown: { select: { id: true, code: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      );

      return NextResponse.json(movements);
    },
  );
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: sparePartId } = await params;
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      const body: unknown = await req.json();
      const parsed = createStockMovementSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      // Enforce that the sparePartId in body matches the URL param
      if (parsed.data.sparePartId !== sparePartId) {
        return NextResponse.json(
          { error: "spare_part_id_mismatch" },
          { status: 400 },
        );
      }

      // Check role permission for this movement type
      const allowedRoles = ALLOWED_ROLES_BY_TYPE[parsed.data.type];
      if (!allowedRoles.includes(ctx.role)) {
        return NextResponse.json(
          {
            error: "forbidden",
            message: `Role ${ctx.role} cannot create movement of type ${parsed.data.type}`,
          },
          { status: 403 },
        );
      }

      let result;
      try {
        result = await withFactoryTx((tx) =>
          createStockMovement(
            tx,
            {
              sparePartId: parsed.data.sparePartId,
              type: parsed.data.type,
              quantity: parsed.data.quantity,
              machineId: parsed.data.machineId,
              breakdownId: parsed.data.breakdownId,
              unitPrice: parsed.data.unitPrice,
              note: parsed.data.note,
            },
            ctx.userId,
            ctx.factoryId!,
          ),
        );
      } catch (err) {
        if (err instanceof StockServiceError) {
          const statusMap: Record<string, number> = {
            not_found: 404,
            insufficient_stock: 422,
            invalid_quantity: 400,
            invalid_type: 400,
          };
          return NextResponse.json(
            { error: err.code, message: err.message },
            { status: statusMap[err.code] ?? 422 },
          );
        }
        throw err;
      }

      const now = new Date().toISOString();

      await events.publish({
        id: randomUUID(),
        type: "stock.movement",
        factoryId: ctx.factoryId ?? null,
        actorId: ctx.userId,
        occurredAt: now,
        sparePartId,
        movementType: parsed.data.type,
        delta: result.delta,
        newBalance: result.newBalance,
      });

      if (result.minimumReached) {
        await events.publish({
          id: randomUUID(),
          type: "stock.minimum_reached",
          factoryId: ctx.factoryId ?? null,
          actorId: ctx.userId,
          occurredAt: now,
          sparePartId,
          currentStock: result.newBalance,
        });
      }

      return NextResponse.json(result.movement, { status: 201 });
    },
  );
}
