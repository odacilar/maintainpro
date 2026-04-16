/**
 * POST /api/photos/upload
 *
 * Accepts multipart/form-data with fields:
 *   file          — File (image/jpeg | image/png | image/webp, max 10 MB)
 *   referenceType — PhotoReferenceType enum value (e.g. "MACHINE")
 *   referenceId   — ID of the related entity
 *   description   — (optional) free-text description
 *
 * Returns the created Photo record with a resolved `url` field.
 *
 * Roles: all authenticated.
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { getTenant } from "@/lib/tenant/context";
import { uploadFile, resolveUrl } from "@/lib/services/storage-service";
import { PhotoReferenceType } from "@prisma/client";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const ctx = getTenant();

      // --- Parse multipart form ---
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return NextResponse.json(
          { error: "Geçersiz form verisi." },
          { status: 400 },
        );
      }

      const file = formData.get("file") as File | null;
      const referenceTypeRaw = formData.get("referenceType") as string | null;
      const referenceId = formData.get("referenceId") as string | null;

      // --- Validate required fields ---
      if (!file || !referenceTypeRaw || !referenceId) {
        return NextResponse.json(
          { error: "file, referenceType ve referenceId zorunludur." },
          { status: 400 },
        );
      }

      // --- Validate referenceType enum ---
      const referenceType = referenceTypeRaw as PhotoReferenceType;
      if (!Object.values(PhotoReferenceType).includes(referenceType)) {
        return NextResponse.json(
          { error: `Geçersiz referenceType: ${referenceTypeRaw}` },
          { status: 400 },
        );
      }

      // --- Validate file type ---
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "Yalnızca JPEG, PNG ve WebP dosyaları kabul edilmektedir." },
          { status: 400 },
        );
      }

      // --- Validate file size ---
      if (file.size > MAX_SIZE_BYTES) {
        return NextResponse.json(
          { error: "Dosya boyutu 10 MB'ı aşamaz." },
          { status: 400 },
        );
      }

      // --- Upload file ---
      const buffer = Buffer.from(await file.arrayBuffer());
      const { key, sizeBytes } = await uploadFile(
        buffer,
        file.type,
        referenceType.toLowerCase(),
        referenceId,
        ctx.factoryId ?? undefined,
      );

      // --- Persist Photo record ---
      const photo = await withFactoryTx((tx) =>
        tx.photo.create({
          data: {
            factoryId: ctx.factoryId!,
            s3Key: key,
            contentType: file.type,
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
