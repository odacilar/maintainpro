/**
 * POST /api/notifications/fcm-token
 * Saves the Firebase Cloud Messaging registration token for the current user.
 * Called by the frontend after the user grants push-notification permission.
 *
 * Body: { token: string }
 * All authenticated roles.
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { z } from "zod";

const bodySchema = z.object({
  token: z.string().min(1, "FCM token boş olamaz"),
});

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
          { error: "Geçersiz istek", details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      await withFactoryTx(async (tx) => {
        await tx.user.update({
          where: { id: ctx.userId },
          data: { fcmToken: parsed.data.token },
        });
      });

      return NextResponse.json({ success: true });
    },
  );
}

/**
 * DELETE /api/notifications/fcm-token
 * Removes the FCM token (e.g. on logout or when the user disables push).
 */
export async function DELETE(): Promise<Response> {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      await withFactoryTx(async (tx) => {
        await tx.user.update({
          where: { id: ctx.userId },
          data: { fcmToken: null },
        });
      });

      return NextResponse.json({ success: true });
    },
  );
}
