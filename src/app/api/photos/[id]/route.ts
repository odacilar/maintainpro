/**
 * DELETE /api/photos/[id]
 *
 * Deletes the photo record and the underlying file.
 *
 * Authorization:
 *   - FACTORY_ADMIN can delete any photo in their factory.
 *   - ENGINEER can delete any photo in their factory.
 *   - TECHNICIAN can delete only their own uploads.
 *   - SUPER_ADMIN can delete any photo.
 *
 * Roles: FACTORY_ADMIN, ENGINEER, TECHNICIAN (own photos only).
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { getTenant } from "@/lib/tenant/context";
import { deleteFile } from "@/lib/services/storage-service";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withApiTenant(
    {
      roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"],
    },
    async () => {
      const ctx = getTenant();
      const { id } = params;

      const photo = await withFactoryTx((tx) =>
        tx.photo.findUnique({ where: { id } }),
      );

      if (!photo) {
        return NextResponse.json(
          { error: "Fotoğraf bulunamadı." },
          { status: 404 },
        );
      }

      // Technicians may only delete their own uploads
      if (
        ctx.role === "TECHNICIAN" &&
        photo.uploadedById !== ctx.userId
      ) {
        return NextResponse.json(
          { error: "Bu fotoğrafı silme yetkiniz yok." },
          { status: 403 },
        );
      }

      // Delete file first (best-effort), then the DB record
      await deleteFile(photo.s3Key);

      await withFactoryTx((tx) => tx.photo.delete({ where: { id } }));

      return NextResponse.json({ success: true });
    },
  );
}
