import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { createRecordSchema } from "@/lib/validations/checklist";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { searchParams } = req.nextUrl;
      const machineId = searchParams.get("machineId") ?? undefined;
      const templateId = searchParams.get("templateId") ?? undefined;
      const status = searchParams.get("status") ?? undefined;
      const from = searchParams.get("from");
      const to = searchParams.get("to");

      const where: Prisma.ChecklistRecordWhereInput = {};
      if (machineId) where.machineId = machineId;
      if (templateId) where.templateId = templateId;
      if (status) where.status = status;
      if (from || to) {
        where.scheduledFor = {};
        if (from) where.scheduledFor.gte = new Date(from);
        if (to) where.scheduledFor.lte = new Date(to);
      }

      const records = await withFactoryTx((tx) =>
        tx.checklistRecord.findMany({
          where,
          include: {
            template: { select: { id: true, name: true } },
            machine: { select: { id: true, name: true, code: true } },
            user: { select: { id: true, name: true } },
          },
          orderBy: { scheduledFor: "desc" },
        }),
      );

      return NextResponse.json(records);
    },
  );
}

export async function POST(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async (ctx) => {
      const body: unknown = await req.json();
      const parsed = createRecordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const record = await withFactoryTx(async (tx) => {
        // Verify template belongs to this factory and is active
        const template = await tx.checklistTemplate.findUnique({
          where: { id: parsed.data.templateId },
          select: { id: true, machineId: true, isActive: true },
        });

        if (!template) {
          return null;
        }

        return tx.checklistRecord.create({
          data: {
            factoryId: ctx.factoryId!,
            templateId: parsed.data.templateId,
            machineId: template.machineId,
            userId: ctx.userId,
            scheduledFor: new Date(parsed.data.scheduledFor),
            status: "pending",
          },
          include: {
            template: { select: { id: true, name: true } },
            machine: { select: { id: true, name: true, code: true } },
            user: { select: { id: true, name: true } },
          },
        });
      });

      if (!record) {
        return NextResponse.json(
          { error: "template_not_found", message: "Template not found in this factory" },
          { status: 404 },
        );
      }

      return NextResponse.json(record, { status: 201 });
    },
  );
}
