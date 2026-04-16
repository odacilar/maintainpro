import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { createSparePartSchema } from "@/lib/validations/spare-part";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/services/audit-service";

export async function GET(req: NextRequest) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { searchParams } = req.nextUrl;
      const category = searchParams.get("category") ?? undefined;
      const search = searchParams.get("search") ?? undefined;
      const belowMinimum = searchParams.get("belowMinimum") === "true";

      const where: Prisma.SparePartWhereInput = {};

      if (category) where.category = category;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ];
      }

      // Prisma does not support column-to-column comparisons in `where`, so
      // we fetch with the other filters and apply the belowMinimum check
      // post-query. The @@index([factoryId, currentStock]) keeps this fast.
      const spareParts = await withFactoryTx((tx) =>
        tx.sparePart.findMany({
          where,
          include: {
            _count: { select: { stockMovements: true } },
          },
          orderBy: { name: "asc" },
        }),
      );

      const result = belowMinimum
        ? spareParts.filter((p) => p.currentStock <= p.minimumStock)
        : spareParts;

      return NextResponse.json(result);
    },
  );
}

export async function POST(req: NextRequest) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async (ctx) => {
      const body: unknown = await req.json();
      const parsed = createSparePartSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_error", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const codeConflict = await withFactoryTx((tx) =>
        tx.sparePart.findFirst({ where: { code: parsed.data.code } }),
      );
      if (codeConflict) {
        return NextResponse.json(
          { error: "spare_part_code_conflict" },
          { status: 409 },
        );
      }

      const sparePart = await withFactoryTx((tx) =>
        tx.sparePart.create({
          data: {
            ...parsed.data,
            factoryId: ctx.factoryId!,
            currentStock: 0,
          },
          include: {
            _count: { select: { stockMovements: true } },
          },
        }),
      );

      void writeAuditLog({
        action: "CREATE",
        entityType: "spare_part",
        entityId: sparePart.id,
        entityName: `${sparePart.code} — ${sparePart.name}`,
      });

      return NextResponse.json(sparePart, { status: 201 });
    },
  );
}
