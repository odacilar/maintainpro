import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { Prisma } from "@prisma/client";
import type { Role } from "@/lib/tenant/context";

export async function GET(req: NextRequest) {
  return withApiTenant(
    { roles: ["ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      const { searchParams } = req.nextUrl;
      const dateParam = searchParams.get("date");
      const status = searchParams.get("status") ?? undefined;

      // Default to today if no date provided
      const targetDate = dateParam ? new Date(dateParam) : new Date();
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const where: Prisma.ChecklistRecordWhereInput = {
        scheduledFor: {
          gte: dayStart,
          lte: dayEnd,
        },
        // Only records whose template assignedRoles includes this user's role
        template: {
          assignedRoles: {
            has: ctx.role as Role,
          },
        },
      };

      if (status) where.status = status;

      const records = await withFactoryTx((tx) =>
        tx.checklistRecord.findMany({
          where,
          include: {
            template: {
              select: {
                id: true,
                name: true,
                period: true,
                _count: { select: { items: true } },
              },
            },
            machine: { select: { id: true, name: true, code: true } },
          },
          orderBy: { scheduledFor: "asc" },
        }),
      );

      return NextResponse.json(records);
    },
  );
}
