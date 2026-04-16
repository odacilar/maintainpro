import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { unsafePrisma, withSuperAdminTx } from "@/lib/tenant/prisma";
import { updateFactorySchema } from "@/lib/validations/admin";

type Params = { params: { id: string } };

// ---------------------------------------------------------------------------
// GET /api/admin/factories/[id]
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  return withApiTenant({ roles: ["SUPER_ADMIN"] }, async () => {
    const factory = await unsafePrisma.factory.findUnique({
      where: { id: params.id },
      include: {
        subscription: true,
        _count: {
          select: {
            users: true,
            machines: true,
            breakdowns: true,
          },
        },
      },
    });

    if (!factory) {
      return NextResponse.json(
        { error: "Fabrika bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json(factory);
  });
}

// ---------------------------------------------------------------------------
// PUT /api/admin/factories/[id]
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest, { params }: Params) {
  return withApiTenant({ roles: ["SUPER_ADMIN"] }, async () => {
    const body: unknown = await req.json();
    const parsed = updateFactorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Ensure slug uniqueness if being changed.
    if (parsed.data.slug) {
      const slugConflict = await unsafePrisma.factory.findFirst({
        where: { slug: parsed.data.slug, NOT: { id: params.id } },
        select: { id: true },
      });
      if (slugConflict) {
        return NextResponse.json(
          { error: "Bu slug zaten kullanılmaktadır." },
          { status: 409 },
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { city, address, plan: _plan, ...rest } = parsed.data;

    // Merge city + address into the address column (same convention as POST).
    const mergedAddress =
      city !== undefined || address !== undefined
        ? [city, address].filter(Boolean).join(", ") || undefined
        : undefined;

    const updated = await withSuperAdminTx((tx) =>
      tx.factory.update({
        where: { id: params.id },
        data: {
          ...rest,
          ...(mergedAddress !== undefined ? { address: mergedAddress } : {}),
        },
        include: { subscription: true },
      }),
    );

    return NextResponse.json(updated);
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/factories/[id]
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApiTenant({ roles: ["SUPER_ADMIN"] }, async () => {
    // Guard: refuse deletion if there are active breakdowns or users (data safety).
    const counts = await unsafePrisma.factory.findUnique({
      where: { id: params.id },
      select: {
        _count: {
          select: {
            users: true,
            breakdowns: true,
            machines: true,
          },
        },
      },
    });

    if (!counts) {
      return NextResponse.json(
        { error: "Fabrika bulunamadı." },
        { status: 404 },
      );
    }

    const { users, breakdowns, machines } = counts._count;
    if (users > 0 || breakdowns > 0 || machines > 0) {
      return NextResponse.json(
        {
          error:
            "Fabrikaya ait kullanıcı, arıza veya makine kayıtları bulunmaktadır. Silmeden önce bu kayıtları kaldırın.",
          counts: { users, breakdowns, machines },
        },
        { status: 409 },
      );
    }

    await withSuperAdminTx((tx) =>
      tx.factory.delete({ where: { id: params.id } }),
    );

    return NextResponse.json({ success: true });
  });
}
