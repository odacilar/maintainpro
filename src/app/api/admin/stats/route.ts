import { NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { unsafePrisma } from "@/lib/tenant/prisma";

// Revenue per plan in USD — spec §10.2
const PLAN_REVENUE: Record<string, number> = {
  STARTER: 99,
  PROFESSIONAL: 199,
  ENTERPRISE: 399,
};

// ---------------------------------------------------------------------------
// GET /api/admin/stats — platform-level metrics for the Super Admin dashboard
// ---------------------------------------------------------------------------

export async function GET() {
  return withApiTenant({ roles: ["SUPER_ADMIN"] }, async () => {
    const [
      totalFactories,
      totalUsers,
      totalMachines,
      activeSubscriptions,
      allSubscriptions,
    ] = await Promise.all([
      unsafePrisma.factory.count(),
      unsafePrisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
      unsafePrisma.machine.count(),
      unsafePrisma.subscription.count({ where: { status: "active" } }),
      unsafePrisma.subscription.findMany({
        where: { status: "active" },
        select: { plan: true },
      }),
    ]);

    // Sum monthly recurring revenue from active subscriptions.
    const monthlyRevenue = allSubscriptions.reduce((sum, sub) => {
      return sum + (PLAN_REVENUE[sub.plan] ?? 0);
    }, 0);

    // Count breakdown per plan.
    const planBreakdown = allSubscriptions.reduce<Record<string, number>>(
      (acc, sub) => {
        acc[sub.plan] = (acc[sub.plan] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return NextResponse.json({
      totalFactories,
      totalUsers,
      totalMachines,
      activeSubscriptions,
      revenue: {
        monthlyUsd: monthlyRevenue,
        planBreakdown,
      },
    });
  });
}
