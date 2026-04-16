import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { BreakdownStatus, BreakdownPriority, Prisma } from "@prisma/client";

// Priority sort order — CRITICAL first
const PRIORITY_ORDER: Record<BreakdownPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export async function GET(req: NextRequest) {
  return withApiTenant({ roles: ["TECHNICIAN"] }, async (ctx) => {
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") as BreakdownStatus | null;

    const where: Prisma.BreakdownWhereInput = {
      assigneeId: ctx.userId,
    };

    if (status && Object.values(BreakdownStatus).includes(status)) {
      where.status = status;
    }

    const breakdowns = await withFactoryTx((tx) =>
      tx.breakdown.findMany({
        where,
        include: {
          machine: { select: { id: true, name: true, code: true } },
          timeline: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { toStatus: true, createdAt: true },
          },
        },
        orderBy: { reportedAt: "asc" },
      }),
    );

    // Sort by priority then reportedAt in application layer
    breakdowns.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority];
      const pb = PRIORITY_ORDER[b.priority];
      if (pa !== pb) return pa - pb;
      return a.reportedAt.getTime() - b.reportedAt.getTime();
    });

    return NextResponse.json(breakdowns);
  });
}
