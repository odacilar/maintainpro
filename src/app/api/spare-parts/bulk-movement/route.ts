/**
 * POST /api/spare-parts/bulk-movement
 *
 * Creates multiple PURCHASE_IN stock movements in a single transaction,
 * updating currentStock for each part atomically.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { createStockMovement, StockServiceError } from "@/lib/services/stock-service";
import { StockMovementType } from "@prisma/client";

const bulkMovementSchema = z.object({
  type: z.literal("IN"),
  movements: z
    .array(
      z.object({
        sparePartId: z.string().cuid(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative().optional(),
        note: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async (ctx) => {
      const body: unknown = await req.json();
      const parsed = bulkMovementSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { movements } = parsed.data;
      let created = 0;
      const errors: { sparePartId: string; reason: string }[] = [];

      // Process each movement in its own transaction so a single failure
      // doesn't roll back the others. Partial success is acceptable for bulk entry.
      for (const mv of movements) {
        try {
          await withFactoryTx((tx) =>
            createStockMovement(
              tx,
              {
                sparePartId: mv.sparePartId,
                type: StockMovementType.PURCHASE_IN,
                quantity: mv.quantity,
                unitPrice: mv.unitPrice,
                note: mv.note,
              },
              ctx.userId,
              ctx.factoryId!,
            ),
          );
          created++;
        } catch (err) {
          const reason =
            err instanceof StockServiceError
              ? err.message
              : "Beklenmeyen bir hata oluştu.";
          errors.push({ sparePartId: mv.sparePartId, reason });
        }
      }

      return NextResponse.json({ created, failed: errors.length, errors });
    },
  );
}
