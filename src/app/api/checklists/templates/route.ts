import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { createTemplateSchema } from "@/lib/validations/checklist";
import { ChecklistPeriod, Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async () => {
      const { searchParams } = req.nextUrl;
      const machineId = searchParams.get("machineId") ?? undefined;
      const periodRaw = searchParams.get("period");
      const isActiveRaw = searchParams.get("isActive");

      const where: Prisma.ChecklistTemplateWhereInput = {};
      if (machineId) where.machineId = machineId;
      if (
        periodRaw &&
        Object.values(ChecklistPeriod).includes(periodRaw as ChecklistPeriod)
      ) {
        where.period = periodRaw as ChecklistPeriod;
      }
      if (isActiveRaw !== null) {
        where.isActive = isActiveRaw !== "false";
      }

      const templates = await withFactoryTx((tx) =>
        tx.checklistTemplate.findMany({
          where,
          include: {
            machine: { select: { id: true, name: true, code: true } },
            _count: { select: { items: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      );

      return NextResponse.json(templates);
    },
  );
}

export async function POST(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async (ctx) => {
      const body: unknown = await req.json();
      const parsed = createTemplateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { items, ...templateData } = parsed.data;

      const template = await withFactoryTx((tx) =>
        tx.checklistTemplate.create({
          data: {
            ...templateData,
            factoryId: ctx.factoryId!,
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
          },
          include: {
            machine: { select: { id: true, name: true, code: true } },
            items: { orderBy: { orderIndex: "asc" } },
            _count: { select: { items: true } },
          },
        }),
      );

      return NextResponse.json(template, { status: 201 });
    },
  );
}
