import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { checkSubscriptionLimit } from "@/lib/auth/subscription-guard";

type Params = { params: { id: string } };

// ---------------------------------------------------------------------------
// GET /api/admin/factories/[id]/check-limits
// Returns current usage vs subscription limits for users, machines, storage.
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  return withApiTenant({ roles: ["SUPER_ADMIN"] }, async () => {
    const [users, machines, storage] = await Promise.all([
      checkSubscriptionLimit(params.id, "users"),
      checkSubscriptionLimit(params.id, "machines"),
      checkSubscriptionLimit(params.id, "storage"),
    ]);

    return NextResponse.json({
      users,
      machines,
      storage: {
        allowed: storage.allowed,
        // Expose storage in GB for readability.
        currentBytes: storage.current,
        maxBytes: storage.max,
        currentGb: +(storage.current / (1024 * 1024 * 1024)).toFixed(3),
        maxGb: +(storage.max / (1024 * 1024 * 1024)).toFixed(0),
      },
    });
  });
}
