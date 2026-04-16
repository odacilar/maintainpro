import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { updateSparePartSchema } from "@/lib/validations/spare-part";
import { writeAuditLog, diffChanges } from "@/lib/services/audit-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const sparePart = await withFactoryTx((tx) =>
        tx.sparePart.findUnique({
          where: { id },
          include: {
            stockMovements: {
              take: 20,
              orderBy: { createdAt: "desc" },
              include: {
                user: { select: { id: true, name: true } },
                machine: { select: { id: true, name: true, code: true } },
              },
            },
            _count: { select: { stockMovements: true } },
          },
        }),
      );

      if (!sparePart) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      return NextResponse.json(sparePart);
    },
  );
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async () => {
      const body: unknown = await req.json();
      const parsed = updateSparePartSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const existing = await withFactoryTx((tx) =>
        tx.sparePart.findUnique({ where: { id } }),
      );
      if (!existing) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      // Check code uniqueness if code is being changed
      if (parsed.data.code && parsed.data.code !== existing.code) {
        const codeConflict = await withFactoryTx((tx) =>
          tx.sparePart.findFirst({ where: { code: parsed.data.code } }),
        );
        if (codeConflict) {
          return NextResponse.json(
            { error: "spare_part_code_conflict" },
            { status: 409 },
          );
        }
      }

      const sparePart = await withFactoryTx((tx) =>
        tx.sparePart.update({
          where: { id },
          data: parsed.data,
          include: {
            _count: { select: { stockMovements: true } },
          },
        }),
      );

      void writeAuditLog({
        action: "UPDATE",
        entityType: "spare_part",
        entityId: sparePart.id,
        entityName: `${sparePart.code} — ${sparePart.name}`,
        changes: diffChanges(
          existing as unknown as Record<string, unknown>,
          sparePart as unknown as Record<string, unknown>,
        ),
      });

      return NextResponse.json(sparePart);
    },
  );
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  return withApiTenant(
    { roles: ["FACTORY_ADMIN"] },
    async () => {
      const existing = await withFactoryTx((tx) =>
        tx.sparePart.findUnique({ where: { id } }),
      );
      if (!existing) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      if (existing.currentStock > 0) {
        return NextResponse.json(
          {
            error: "spare_part_has_stock",
            message: "Cannot delete a spare part with remaining stock",
          },
          { status: 409 },
        );
      }

      await withFactoryTx((tx) => tx.sparePart.delete({ where: { id } }));

      return NextResponse.json({ success: true });
    },
  );
}
