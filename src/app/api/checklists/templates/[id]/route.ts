import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { updateTemplateSchema } from "@/lib/validations/checklist";
import { Prisma } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async () => {
      const { id } = await params;

      const template = await withFactoryTx((tx) =>
        tx.checklistTemplate.findUnique({
          where: { id },
          include: {
            machine: { select: { id: true, name: true, code: true } },
            items: { orderBy: { orderIndex: "asc" } },
          },
        }),
      );

      if (!template) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      return NextResponse.json(template);
    },
  );
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async () => {
      const { id } = await params;

      const body: unknown = await req.json();
      const parsed = updateTemplateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { items, ...templateFields } = parsed.data;

      const updated = await withFactoryTx(async (tx) => {
        const existing = await tx.checklistTemplate.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!existing) {
          return null;
        }

        if (items !== undefined) {
          // Full replacement: delete all existing items then recreate
          await tx.checklistItem.deleteMany({ where: { templateId: id } });
        }

        return tx.checklistTemplate.update({
          where: { id },
          data: {
            ...templateFields,
            ...(items !== undefined
              ? {
                  items: {
                    create: items.map((item, index) => ({
                      orderIndex: index,
                      title: item.title,
                      type: item.type,
                      referenceValue: item.referenceValue ?? null,
                      photoRequired: item.photoRequired ?? false,
                      meta: item.meta != null
                          ? (item.meta as Prisma.InputJsonValue)
                          : Prisma.JsonNull,
                    })),
                  },
                }
              : {}),
          },
          include: {
            machine: { select: { id: true, name: true, code: true } },
            items: { orderBy: { orderIndex: "asc" } },
          },
        });
      });

      if (!updated) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      return NextResponse.json(updated);
    },
  );
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN"] },
    async () => {
      const { id } = await params;

      const result = await withFactoryTx(async (tx) => {
        const existing = await tx.checklistTemplate.findUnique({
          where: { id },
          select: { id: true, _count: { select: { records: true } } },
        });

        if (!existing) {
          return { notFound: true } as const;
        }

        if (existing._count.records > 0) {
          return { hasRecords: true } as const;
        }

        await tx.checklistTemplate.delete({ where: { id } });
        return { deleted: true } as const;
      });

      if ("notFound" in result) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      if ("hasRecords" in result) {
        return NextResponse.json(
          { error: "has_records", message: "Cannot delete a template that has execution records" },
          { status: 409 },
        );
      }

      return NextResponse.json({ success: true });
    },
  );
}
