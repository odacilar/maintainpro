/**
 * POST /api/breakdowns/bulk
 *
 * Bulk breakdown operations: close (RESOLVED → CLOSED) or assign (OPEN → ASSIGNED).
 * Each successful operation writes a timeline entry. Returns counts of success/failure.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { transitionBreakdown, ServiceError } from "@/lib/services/breakdown-service";
import { BreakdownStatus } from "@prisma/client";

const bulkBreakdownSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("close"),
    ids: z.array(z.string().cuid()).min(1).max(100),
  }),
  z.object({
    action: z.literal("assign"),
    ids: z.array(z.string().cuid()).min(1).max(100),
    assigneeId: z.string().cuid(),
  }),
]);

export async function POST(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async (ctx) => {
      const body: unknown = await req.json();
      const parsed = bulkBreakdownSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { action, ids } = parsed.data;

      let success = 0;
      const errors: { id: string; reason: string }[] = [];

      for (const id of ids) {
        try {
          if (action === "close") {
            // Verify current status is RESOLVED before attempting transition
            const breakdown = await withFactoryTx((tx) =>
              tx.breakdown.findUnique({ where: { id }, select: { status: true } }),
            );

            if (!breakdown) {
              errors.push({ id, reason: "Arıza bulunamadı." });
              continue;
            }

            if (breakdown.status !== BreakdownStatus.RESOLVED) {
              errors.push({
                id,
                reason: `Yalnızca 'Çözüldü' durumundaki arızalar kapatılabilir. Mevcut durum: ${breakdown.status}`,
              });
              continue;
            }

            await withFactoryTx((tx) =>
              transitionBreakdown(
                tx,
                id,
                BreakdownStatus.CLOSED,
                ctx.userId,
                ctx.factoryId!,
              ),
            );
          } else {
            // action === "assign"
            const breakdown = await withFactoryTx((tx) =>
              tx.breakdown.findUnique({ where: { id }, select: { status: true } }),
            );

            if (!breakdown) {
              errors.push({ id, reason: "Arıza bulunamadı." });
              continue;
            }

            if (breakdown.status !== BreakdownStatus.OPEN) {
              errors.push({
                id,
                reason: `Yalnızca 'Açık' durumundaki arızalar atanabilir. Mevcut durum: ${breakdown.status}`,
              });
              continue;
            }

            await withFactoryTx((tx) =>
              transitionBreakdown(
                tx,
                id,
                BreakdownStatus.ASSIGNED,
                ctx.userId,
                ctx.factoryId!,
                { assigneeId: (parsed.data as { assigneeId: string }).assigneeId },
              ),
            );
          }

          success++;
        } catch (err) {
          const reason =
            err instanceof ServiceError ? err.message : "Beklenmeyen bir hata oluştu.";
          errors.push({ id, reason });
        }
      }

      return NextResponse.json({ success, failed: errors.length, errors });
    },
  );
}
