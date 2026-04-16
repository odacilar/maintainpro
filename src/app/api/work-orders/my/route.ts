import { NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { WorkOrderStatus, Prisma } from "@prisma/client";

export async function GET() {
  return withApiTenant(
    { roles: ["TECHNICIAN", "ENGINEER", "FACTORY_ADMIN"] },
    async (ctx) => {
      const now = new Date();

      // Today's start / upcoming window (next 7 days)
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const upcomingEnd = new Date(todayStart);
      upcomingEnd.setDate(upcomingEnd.getDate() + 7);

      const where: Prisma.WorkOrderWhereInput = {
        assigneeId: ctx.userId,
        status: {
          in: [WorkOrderStatus.PLANNED, WorkOrderStatus.IN_PROGRESS],
        },
        scheduledFor: { lte: upcomingEnd },
      };

      const workOrders = await withFactoryTx((tx) =>
        tx.workOrder.findMany({
          where,
          include: {
            machine: {
              select: {
                id: true,
                name: true,
                code: true,
                department: { select: { id: true, name: true } },
              },
            },
            pmPlan: {
              select: {
                id: true,
                name: true,
                estimatedDurationMinutes: true,
                taskList: true,
              },
            },
          },
          orderBy: { scheduledFor: "asc" },
        }),
      );

      // Split into today vs upcoming for convenience
      const today = workOrders.filter(
        (wo) => wo.scheduledFor >= todayStart && wo.scheduledFor < new Date(todayStart.getTime() + 86400000),
      );
      const upcoming = workOrders.filter(
        (wo) => wo.scheduledFor >= new Date(todayStart.getTime() + 86400000),
      );

      return NextResponse.json({ today, upcoming });
    },
  );
}
