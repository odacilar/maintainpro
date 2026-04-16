import { NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";

/**
 * GET /api/notifications/count
 * Returns the unread IN_APP notification count for the authenticated user.
 * Used by the topbar badge — all roles.
 */
export async function GET(): Promise<Response> {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      const count = await withFactoryTx((tx) =>
        tx.notification.count({
          where: {
            userId: ctx.userId,
            channel: "IN_APP",
            readAt: null,
          },
        }),
      );

      return NextResponse.json({ count });
    },
  );
}
