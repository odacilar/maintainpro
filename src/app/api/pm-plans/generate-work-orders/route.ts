/**
 * POST /api/pm-plans/generate-work-orders
 *
 * Manually triggers PM work order generation for the authenticated user's factory.
 * Useful from the Planlı Bakım page ("Toplu İş Emri Oluştur" button).
 *
 * Roles: FACTORY_ADMIN, ENGINEER
 */

import { NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { generateWorkOrders } from "@/lib/services/pm-service";

export async function POST() {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async (ctx) => {
      const workOrders = await withFactoryTx((tx) =>
        generateWorkOrders(tx, ctx.factoryId!),
      );

      return NextResponse.json({ created: workOrders.length });
    },
  );
}
