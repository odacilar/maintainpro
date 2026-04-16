import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { ActionStatus, ActionPriority, Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { searchParams } = req.nextUrl;
      const statusRaw = searchParams.get("status");
      const priorityRaw = searchParams.get("priority");
      const machineId = searchParams.get("machineId") ?? undefined;

      const where: Prisma.ActionWhereInput = {};

      if (
        statusRaw &&
        Object.values(ActionStatus).includes(statusRaw as ActionStatus)
      ) {
        where.status = statusRaw as ActionStatus;
      }

      if (
        priorityRaw &&
        Object.values(ActionPriority).includes(priorityRaw as ActionPriority)
      ) {
        where.priority = priorityRaw as ActionPriority;
      }

      if (machineId) {
        where.record = { machineId };
      }

      const actions = await withFactoryTx((tx) =>
        tx.action.findMany({
          where,
          include: {
            record: {
              select: {
                id: true,
                template: { select: { id: true, name: true } },
              },
            },
            itemResponse: {
              select: {
                id: true,
                isAbnormal: true,
                note: true,
                item: { select: { id: true, title: true } },
              },
            },
            assignee: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      );

      return NextResponse.json(actions);
    },
  );
}
