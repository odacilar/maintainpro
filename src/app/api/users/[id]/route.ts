import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { z } from "zod";
import { Role } from "@prisma/client";
import { writeAuditLog, diffChanges } from "@/lib/services/audit-service";

type Params = { params: { id: string } };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z
    .nativeEnum(Role)
    .refine((r) => r !== "SUPER_ADMIN", {
      message: "Bu endpoint ile SUPER_ADMIN rolü atanamaz.",
    })
    .optional(),
  departmentId: z.string().cuid().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// PUT /api/users/[id] — update user fields (FACTORY_ADMIN only)
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest, { params }: Params) {
  return withApiTenant({ roles: ["FACTORY_ADMIN"] }, async () => {
    const body: unknown = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Verify the user belongs to this factory (RLS middleware handles the
    // factoryId injection, so findFirst will naturally scope to this tenant).
    const existing = await withFactoryTx((tx) =>
      tx.user.findFirst({ where: { id: params.id }, select: { id: true } }),
    );
    if (!existing) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    const updated = await withFactoryTx((tx) =>
      tx.user.update({
        where: { id: params.id },
        data: parsed.data,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
          department: { select: { id: true, name: true } },
        },
      }),
    );

    void writeAuditLog({
      action: "UPDATE",
      entityType: "user",
      entityId: updated.id,
      entityName: `${updated.name} (${updated.email})`,
      changes: diffChanges(
        existing as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
      ),
    });

    return NextResponse.json(updated);
  });
}
