import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { updateActionSchema } from "@/lib/validations/checklist";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { id } = await params;

      const action = await withFactoryTx((tx) =>
        tx.action.findUnique({
          where: { id },
          include: {
            record: {
              include: {
                template: { select: { id: true, name: true, period: true } },
                machine: { select: { id: true, name: true, code: true } },
              },
            },
            itemResponse: {
              include: {
                item: { select: { id: true, title: true, type: true } },
              },
            },
            assignee: { select: { id: true, name: true, email: true } },
            verifier: { select: { id: true, name: true, email: true } },
          },
        }),
      );

      if (!action) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      return NextResponse.json(action);
    },
  );
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async () => {
      const { id } = await params;

      const body: unknown = await req.json();
      const parsed = updateActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const updated = await withFactoryTx(async (tx) => {
        const existing = await tx.action.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!existing) return null;

        const { targetDate, assigneeId, ...rest } = parsed.data;

        return tx.action.update({
          where: { id },
          data: {
            ...rest,
            ...(assigneeId !== undefined ? { assigneeId } : {}),
            ...(targetDate !== undefined
              ? { targetDate: targetDate ? new Date(targetDate) : null }
              : {}),
          },
          include: {
            assignee: { select: { id: true, name: true } },
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
