import { NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";

/**
 * GET /api/dashboard/summary
 * Admin dashboard summary card data.
 * Roles: FACTORY_ADMIN, ENGINEER
 */
export async function GET(): Promise<Response> {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async (ctx) => {
      const now = new Date();
      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      const [
        activeBreakdowns,
        resolvedToday,
        machineStatusGroups,
        unreadNotifications,
        allSpareParts,
        checklistsTotal,
        checklistsCompleted,
        openActions,
      ] = await withFactoryTx((tx) =>
        Promise.all([
          // Active breakdowns: OPEN | ASSIGNED | IN_PROGRESS | WAITING_PARTS
          tx.breakdown.count({
            where: {
              status: {
                in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_PARTS"],
              },
            },
          }),

          // Resolved/closed today (closedAt OR resolvedAt within today UTC)
          tx.breakdown.count({
            where: {
              status: { in: ["RESOLVED", "CLOSED"] },
              OR: [
                { resolvedAt: { gte: todayStart, lt: todayEnd } },
                { closedAt: { gte: todayStart, lt: todayEnd } },
              ],
            },
          }),

          // Machine status distribution
          tx.machine.groupBy({
            by: ["status"],
            _count: { id: true },
          }),

          // Unread IN_APP notifications for the current user
          tx.notification.count({
            where: {
              userId: ctx.userId,
              channel: "IN_APP",
              readAt: null,
            },
          }),

          // Low-stock spare parts: currentStock <= minimumStock
          // Prisma does not support column-to-column comparisons in where; use findMany + filter
          tx.sparePart.findMany({
            select: { currentStock: true, minimumStock: true },
          }),

          // Today's total scheduled checklist records
          tx.checklistRecord.count({
            where: {
              scheduledFor: { gte: todayStart, lt: todayEnd },
            },
          }),

          // Today's completed checklist records
          tx.checklistRecord.count({
            where: {
              scheduledFor: { gte: todayStart, lt: todayEnd },
              status: "completed",
            },
          }),

          // Open actions (OPEN or IN_PROGRESS)
          tx.action.count({
            where: {
              status: { in: ["OPEN", "IN_PROGRESS"] },
            },
          }),
        ]),
      );

      const lowStockParts = allSpareParts.filter(
        (p) => p.currentStock <= p.minimumStock,
      ).length;

      // Build machineStatus map from groupBy result
      const machineStatus = {
        running: 0,
        broken: 0,
        inMaintenance: 0,
        decommissioned: 0,
      };
      for (const row of machineStatusGroups) {
        const count = row._count.id;
        switch (row.status) {
          case "RUNNING":
            machineStatus.running = count;
            break;
          case "BROKEN":
            machineStatus.broken = count;
            break;
          case "IN_MAINTENANCE":
            machineStatus.inMaintenance = count;
            break;
          case "DECOMMISSIONED":
            machineStatus.decommissioned = count;
            break;
        }
      }

      const rate =
        checklistsTotal > 0
          ? Math.round((checklistsCompleted / checklistsTotal) * 1000) / 10
          : 0;

      return NextResponse.json({
        activeBreakdowns,
        resolvedToday,
        machineStatus,
        unreadNotifications,
        lowStockParts: lowStockParts,
        checklistComplianceToday: {
          completed: checklistsCompleted,
          total: checklistsTotal,
          rate,
        },
        openActions,
      });
    },
  );
}
