import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { getTenant } from "@/lib/tenant/context";
import { resolveUrl } from "@/lib/services/storage-service";
import { PhotoReferenceType } from "@prisma/client";

export async function POST(req: NextRequest) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const body = await req.json().catch(() => ({}));
      const { key, contentType, sizeBytes, referenceType: refTypeRaw, referenceId } = body;

      if (!key || !contentType || !sizeBytes || !refTypeRaw || !referenceId) {
        return NextResponse.json({ error: "Eksik alan." }, { status: 400 });
      }

      const referenceType = refTypeRaw as PhotoReferenceType;
      if (!Object.values(PhotoReferenceType).includes(referenceType)) {
        return NextResponse.json({ error: `Geçersiz referenceType: ${refTypeRaw}` }, { status: 400 });
      }

      const ctx = getTenant();

      const photo = await withFactoryTx((tx) =>
        tx.photo.create({
          data: {
            factoryId: ctx.factoryId!,
            s3Key: key,
            contentType,
            sizeBytes,
            referenceType,
            referenceId,
            uploadedById: ctx.userId,
          },
          include: {
            uploadedBy: { select: { id: true, name: true } },
          },
        }),
      );

      const url = await resolveUrl(key);
      return NextResponse.json({ ...photo, url }, { status: 201 });
    },
  );
}
