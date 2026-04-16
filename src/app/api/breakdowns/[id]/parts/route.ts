import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { events } from "@/lib/events";
import {
  createStockMovement,
  StockServiceError,
} from "@/lib/services/stock-service";
import { StockMovementType } from "@prisma/client";
import { z } from "zod";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

// Body for issuing parts against a breakdown — type is always BREAKDOWN_OUT
const breakdownStockOutSchema = z.object({
  sparePartId: z.string().cuid(),
  quantity: z.number().int().positive(),
  machineId: z.string().cuid().optional(),
  note: z.string().max(2000).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: breakdownId } = await params;
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const breakdown = await withFactoryTx((tx) =>
        tx.breakdown.findUnique({ where: { id: breakdownId } }),
      );
      if (!breakdown) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      const movements = await withFactoryTx((tx) =>
        tx.stockMovement.findMany({
          where: { breakdownId },
          include: {
            sparePart: {
              select: { id: true, name: true, code: true, unit: true },
            },
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      );

      return NextResponse.json(movements);
    },
  );
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: breakdownId } = await params;
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      const body: unknown = await req.json();
      const parsed = breakdownStockOutSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const breakdown = await withFactoryTx((tx) =>
        tx.breakdown.findUnique({ where: { id: breakdownId } }),
      );
      if (!breakdown) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      let result;
      try {
        result = await withFactoryTx((tx) =>
          createStockMovement(
            tx,
            {
              sparePartId: parsed.data.sparePartId,
              type: StockMovementType.BREAKDOWN_OUT,
              quantity: parsed.data.quantity,
              // Prefer explicitly provided machineId, fall back to breakdown's machine
              machineId: parsed.data.machineId ?? breakdown.machineId,
              breakdownId,
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
        sparePartId: parsed.data.sparePartId,
        movementType: StockMovementType.BREAKDOWN_OUT,
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
          sparePartId: parsed.data.sparePartId,
          currentStock: result.newBalance,
        });
      }

      return NextResponse.json(result.movement, { status: 201 });
    },
  );
}
