import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { z } from "zod";

const bodySchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().cuid()).min(1) }),
]);

/**
 * POST /api/notifications/read
 * Mark notifications as read for the authenticated user.
 * Body: { all: true } OR { ids: string[] }
 * All roles.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
      }

      const parsed = bodySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Geçersiz istek gövdesi", details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const now = new Date();

      await withFactoryTx(async (tx) => {
        if ("all" in parsed.data && parsed.data.all) {
          // Mark all unread notifications for this user as read
          await tx.notification.updateMany({
            where: {
              userId: ctx.userId,
              channel: "IN_APP",
              readAt: null,
            },
            data: { readAt: now },
          });
        } else if ("ids" in parsed.data) {
          // Mark specific notifications as read — only those belonging to user
          await tx.notification.updateMany({
            where: {
              id: { in: parsed.data.ids },
              userId: ctx.userId, // Scoped to caller; cannot mark another user's notifications
              channel: "IN_APP",
              readAt: null,
            },
            data: { readAt: now },
          });
        }
      });

      return NextResponse.json({ success: true });
    },
  );
}
