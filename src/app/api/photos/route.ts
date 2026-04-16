/**
 * GET /api/photos?referenceType=MACHINE&referenceId=<id>
 *
 * Returns all photos for a given polymorphic reference, newest first.
 * Both query params are required.
 *
 * Roles: all authenticated.
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { resolveUrl } from "@/lib/services/storage-service";
import { PhotoReferenceType } from "@prisma/client";

export async function GET(req: NextRequest) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { searchParams } = req.nextUrl;
      const referenceTypeRaw = searchParams.get("referenceType");
      const referenceId = searchParams.get("referenceId");

      if (!referenceTypeRaw || !referenceId) {
        return NextResponse.json(
          { error: "referenceType ve referenceId zorunludur." },
          { status: 400 },
        );
      }

      const referenceType = referenceTypeRaw as PhotoReferenceType;
      if (!Object.values(PhotoReferenceType).includes(referenceType)) {
        return NextResponse.json(
          { error: `Geçersiz referenceType: ${referenceTypeRaw}` },
          { status: 400 },
        );
      }

      const photos = await withFactoryTx((tx) =>
        tx.photo.findMany({
          where: { referenceType, referenceId },
          include: {
            uploadedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      );

      // Resolve URLs (presigned on S3, direct path locally)
      const photosWithUrl = await Promise.all(
        photos.map(async (p) => ({ ...p, url: await resolveUrl(p.s3Key) })),
      );

      return NextResponse.json(photosWithUrl);
    },
  );
}
