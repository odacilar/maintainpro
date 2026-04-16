import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { z } from "zod";

const querySchema = z.object({
  unreadOnly: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 0))
    .pipe(z.number().int().min(0)),
});

/**
 * GET /api/notifications
 * List notifications for the authenticated user.
 * Query params: unreadOnly (boolean), limit (default 20), offset (default 0)
 * All roles.
 */
export async function GET(req: NextRequest): Promise<Response> {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      const { searchParams } = req.nextUrl;
      const parsed = querySchema.safeParse({
        unreadOnly: searchParams.get("unreadOnly") ?? undefined,
        limit: searchParams.get("limit") ?? undefined,
        offset: searchParams.get("offset") ?? undefined,
      });

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Geçersiz sorgu parametresi", details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { unreadOnly, limit, offset } = parsed.data;

      const [notifications, unreadCount] = await withFactoryTx(async (tx) => {
        const where = {
          userId: ctx.userId,
          // Filter to only IN_APP channel — other channels are deferred
          channel: "IN_APP" as const,
          ...(unreadOnly ? { readAt: null } : {}),
        };

        const [rows, count] = await Promise.all([
          tx.notification.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
            select: {
              id: true,
              eventType: true,
              title: true,
              body: true,
              referenceType: true,
              referenceId: true,
              readAt: true,
              createdAt: true,
            },
          }),
          tx.notification.count({
            where: { userId: ctx.userId, channel: "IN_APP", readAt: null },
          }),
        ]);

        return [rows, count];
      });

      return NextResponse.json({ notifications, unreadCount });
    },
  );
}
