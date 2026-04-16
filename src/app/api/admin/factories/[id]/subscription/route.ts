import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { unsafePrisma, withSuperAdminTx } from "@/lib/tenant/prisma";
import { updateSubscriptionSchema } from "@/lib/validations/admin";
import { PLAN_LIMITS } from "@/lib/auth/subscription-guard";
import { SubscriptionPlan } from "@prisma/client";

type Params = { params: { id: string } };

// ---------------------------------------------------------------------------
// GET /api/admin/factories/[id]/subscription
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  return withApiTenant({ roles: ["SUPER_ADMIN"] }, async () => {
    const subscription = await unsafePrisma.subscription.findUnique({
      where: { factoryId: params.id },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Bu fabrikaya ait abonelik bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json(subscription);
  });
}

// ---------------------------------------------------------------------------
// PUT /api/admin/factories/[id]/subscription
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest, { params }: Params) {
  return withApiTenant({ roles: ["SUPER_ADMIN"] }, async () => {
    const body: unknown = await req.json();
    const parsed = updateSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { plan, maxUsers, maxMachines, maxStorageGb, isActive } = parsed.data;

    // If explicit limits are not provided for a plan change, default to the
    // plan defaults so the caller can omit them when just changing the plan.
    const planDefaults = PLAN_LIMITS[plan as SubscriptionPlan];

    const subscription = await withSuperAdminTx((tx) =>
      tx.subscription.upsert({
        where: { factoryId: params.id },
        update: {
          plan: plan as SubscriptionPlan,
          userLimit: maxUsers ?? planDefaults.maxUsers,
          machineLimit: maxMachines ?? planDefaults.maxMachines,
          storageLimitGb: maxStorageGb ?? planDefaults.maxStorageGb,
          status: isActive ? "active" : "cancelled",
        },
        create: {
          factoryId: params.id,
          plan: plan as SubscriptionPlan,
          userLimit: maxUsers ?? planDefaults.maxUsers,
          machineLimit: maxMachines ?? planDefaults.maxMachines,
          storageLimitGb: maxStorageGb ?? planDefaults.maxStorageGb,
          currentPeriodEnd: new Date(
            new Date().setFullYear(new Date().getFullYear() + 1),
          ),
          status: isActive ? "active" : "cancelled",
        },
      }),
    );

    return NextResponse.json(subscription);
  });
}
