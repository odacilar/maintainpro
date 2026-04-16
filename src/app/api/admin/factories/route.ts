import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { unsafePrisma, withSuperAdminTx } from "@/lib/tenant/prisma";
import { createFactorySchema } from "@/lib/validations/admin";
import { PLAN_LIMITS } from "@/lib/auth/subscription-guard";
import { SubscriptionPlan } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/admin/factories — list all factories (Super Admin only)
// ---------------------------------------------------------------------------

export async function GET() {
  return withApiTenant({ roles: ["SUPER_ADMIN"] }, async () => {
    // Cross-tenant read: bypass RLS entirely via unsafePrisma.
    const factories = await unsafePrisma.factory.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        createdAt: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            userLimit: true,
            machineLimit: true,
            storageLimitGb: true,
            currentPeriodEnd: true,
          },
        },
        _count: {
          select: {
            users: true,
            machines: true,
          },
        },
      },
    });

    return NextResponse.json(factories);
  });
}

// ---------------------------------------------------------------------------
// POST /api/admin/factories — create a new factory + subscription (Super Admin)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  return withApiTenant({ roles: ["SUPER_ADMIN"] }, async () => {
    const body: unknown = await req.json();
    const parsed = createFactorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { name, slug, city, address, phone, plan } = parsed.data;

    // Ensure slug is unique.
    const slugConflict = await unsafePrisma.factory.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (slugConflict) {
      return NextResponse.json(
        { error: "Bu slug zaten kullanılmaktadır." },
        { status: 409 },
      );
    }

    const limits = PLAN_LIMITS[plan as SubscriptionPlan];
    // Subscription period: one calendar year from today.
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);

    const factory = await withSuperAdminTx(async (tx) => {
      const created = await tx.factory.create({
        data: {
          name,
          slug,
          // city is not a schema column; store in address field or as part of address.
          address: city && address ? `${city}, ${address}` : city ?? address,
          phone,
        },
      });

      await tx.subscription.create({
        data: {
          factoryId: created.id,
          plan: plan as SubscriptionPlan,
          userLimit: limits.maxUsers,
          machineLimit: limits.maxMachines,
          storageLimitGb: limits.maxStorageGb,
          currentPeriodEnd,
          status: "active",
        },
      });

      return created;
    });

    // Return the factory with its subscription.
    const result = await unsafePrisma.factory.findUnique({
      where: { id: factory.id },
      include: { subscription: true },
    });

    return NextResponse.json(result, { status: 201 });
  });
}
