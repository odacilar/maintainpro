import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { checkSubscriptionLimit } from "@/lib/auth/subscription-guard";
import { z } from "zod";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeAuditLog } from "@/lib/services/audit-service";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role).refine((r) => r !== "SUPER_ADMIN", {
    message: "Bu endpoint ile SUPER_ADMIN kullanıcısı oluşturulamaz.",
  }),
  departmentId: z.string().cuid().optional(),
  phone: z.string().max(20).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/users — list factory users (FACTORY_ADMIN only)
// ---------------------------------------------------------------------------

export async function GET() {
  return withApiTenant({ roles: ["FACTORY_ADMIN"] }, async () => {
    const users = await withFactoryTx((tx) =>
      tx.user.findMany({
        where: { role: { not: "SUPER_ADMIN" } },
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
        orderBy: { name: "asc" },
      }),
    );

    return NextResponse.json(users);
  });
}

// ---------------------------------------------------------------------------
// POST /api/users — invite / create a new factory user (FACTORY_ADMIN only)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  return withApiTenant({ roles: ["FACTORY_ADMIN"] }, async (ctx) => {
    const body: unknown = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Enforce subscription user limit before creating.
    const limitCheck = await checkSubscriptionLimit(ctx.factoryId!, "users");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Abonelik limitinize ulaştınız. Maksimum ${limitCheck.max} kullanıcı ekleyebilirsiniz (mevcut: ${limitCheck.current}). Planınızı yükseltmek için sistem yöneticinizle iletişime geçin.`,
        },
        { status: 403 },
      );
    }

    // Guard: e-posta adresi sistemde unique olmalı.
    const emailConflict = await withFactoryTx((tx) =>
      tx.user.findFirst({ where: { email: parsed.data.email } }),
    );
    if (emailConflict) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kullanılmaktadır." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await withFactoryTx((tx) =>
      tx.user.create({
        data: {
          factoryId: ctx.factoryId!,
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: parsed.data.role,
          departmentId: parsed.data.departmentId,
          phone: parsed.data.phone,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          department: { select: { id: true, name: true } },
        },
      }),
    );

    void writeAuditLog({
      action: "CREATE",
      entityType: "user",
      entityId: user.id,
      entityName: `${user.name} (${user.email})`,
    });

    return NextResponse.json(user, { status: 201 });
  });
}
