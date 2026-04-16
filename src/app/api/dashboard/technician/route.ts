import { NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";

/**
 * GET /api/dashboard/technician
 * Personalised dashboard for the authenticated technician:
 *   - assignedBreakdowns: open breakdowns assigned to me
 *   - todayChecklists: checklist records scheduled for today assigned to my role
 *   - recentActivity: my breakdown timeline entries in the last 7 days (max 10)
 * Roles: TECHNICIAN only
 */
export async function GET(): Promise<Response> {
  return withApiTenant(
    { roles: ["TECHNICIAN"] },
    async (ctx) => {
      const now = new Date();
      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(
        todayStart.getTime() - 7 * 24 * 60 * 60 * 1000,
      );

      const [assignedBreakdowns, todayChecklists, recentActivity] =
        await withFactoryTx((tx) =>
          Promise.all([
            // Breakdowns assigned to me that are not yet closed
            tx.breakdown.findMany({
              where: {
                assigneeId: ctx.userId,
                status: {
                  notIn: ["CLOSED"],
                },
              },
              select: {
                id: true,
                code: true,
                status: true,
                priority: true,
                type: true,
                description: true,
                reportedAt: true,
                respondedAt: true,
                machine: {
                  select: { id: true, name: true, code: true },
                },
                reporter: {
                  select: { id: true, name: true },
                },
              },
              orderBy: [{ priority: "asc" }, { reportedAt: "asc" }],
            }),

            // Today's checklist records that include the TECHNICIAN role
            tx.checklistRecord.findMany({
              where: {
                userId: ctx.userId,
                scheduledFor: { gte: todayStart, lt: todayEnd },
                template: {
                  assignedRoles: { has: "TECHNICIAN" },
                },
              },
              select: {
                id: true,
                status: true,
                scheduledFor: true,
                startedAt: true,
                completedAt: true,
                template: {
                  select: {
                    id: true,
                    name: true,
                    period: true,
                    _count: { select: { items: true } },
                  },
                },
                machine: {
                  select: { id: true, name: true, code: true },
                },
              },
              orderBy: { scheduledFor: "asc" },
            }),

            // My timeline entries in the last 7 days
            tx.breakdownTimeline.findMany({
              where: {
                userId: ctx.userId,
                createdAt: { gte: sevenDaysAgo },
              },
              select: {
                id: true,
                fromStatus: true,
                toStatus: true,
                note: true,
                createdAt: true,
                breakdown: {
                  select: {
                    id: true,
                    code: true,
                    machine: {
                      select: { id: true, name: true, code: true },
                    },
                  },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            }),
          ]),
        );

      return NextResponse.json({
        assignedBreakdowns,
        todayChecklists,
        recentActivity,
      });
    },
  );
}
