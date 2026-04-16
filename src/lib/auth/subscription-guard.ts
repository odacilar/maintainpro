import { unsafePrisma } from "@/lib/tenant/prisma";
import { SubscriptionPlan } from "@prisma/client";

// ---------------------------------------------------------------------------
// Plan limit defaults — spec §10.2
// ---------------------------------------------------------------------------

export const PLAN_LIMITS: Record<
  SubscriptionPlan,
  { maxUsers: number; maxMachines: number; maxStorageGb: number }
> = {
  STARTER: { maxUsers: 5, maxMachines: 20, maxStorageGb: 5 },
  PROFESSIONAL: { maxUsers: 15, maxMachines: 50, maxStorageGb: 20 },
  // Enterprise has no user cap in the spec; 999 is the sentinel value.
  ENTERPRISE: { maxUsers: 999, maxMachines: 100, maxStorageGb: 100 },
};

export type LimitResource = "users" | "machines" | "storage";

export type LimitCheckResult = {
  allowed: boolean;
  current: number;
  max: number;
};

/**
 * Checks whether a factory is within its subscription limits for the given
 * resource before creating a new record.
 *
 * Uses `unsafePrisma` because this is called from factory-scoped endpoints
 * where the tenant Prisma context is already set up; we still need a raw
 * count query that doesn't filter by factoryId again via RLS (the subscription
 * row is only accessible this way from inside the tenant's own context too).
 *
 * Storage checking compares Photo.sizeBytes sum; a `0` total means no photos
 * yet and is handled gracefully.
 */
export async function checkSubscriptionLimit(
  factoryId: string,
  resource: LimitResource,
): Promise<LimitCheckResult> {
  // Fetch the subscription — fall back to plan defaults if limits are not
  // overridden (Super Admin can customise per-factory limits).
  const subscription = await unsafePrisma.subscription.findUnique({
    where: { factoryId },
    select: {
      plan: true,
      userLimit: true,
      machineLimit: true,
      storageLimitGb: true,
      status: true,
    },
  });

  // If the factory has no subscription record yet, deny the operation.
  if (!subscription) {
    return { allowed: false, current: 0, max: 0 };
  }

  // An inactive subscription blocks all resource creation.
  if (subscription.status !== "active") {
    return { allowed: false, current: 0, max: 0 };
  }

  const planDefaults = PLAN_LIMITS[subscription.plan];

  if (resource === "users") {
    const max = subscription.userLimit ?? planDefaults.maxUsers;
    const current = await unsafePrisma.user.count({
      where: { factoryId, isActive: true },
    });
    return { allowed: current < max, current, max };
  }

  if (resource === "machines") {
    const max = subscription.machineLimit ?? planDefaults.maxMachines;
    const current = await unsafePrisma.machine.count({
      where: { factoryId },
    });
    return { allowed: current < max, current, max };
  }

  // resource === "storage"
  const maxGb = subscription.storageLimitGb ?? planDefaults.maxStorageGb;
  const maxBytes = maxGb * 1024 * 1024 * 1024;
  const aggregate = await unsafePrisma.photo.aggregate({
    _sum: { sizeBytes: true },
    where: { factoryId },
  });
  const currentBytes = aggregate._sum.sizeBytes ?? 0;
  return {
    allowed: currentBytes < maxBytes,
    current: currentBytes,
    max: maxBytes,
  };
}
