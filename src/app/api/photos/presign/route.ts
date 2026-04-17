import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { getTenant } from "@/lib/tenant/context";
import { generatePresignedUploadUrl } from "@/lib/services/storage-service";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function extFromMime(contentType: string): string {
  switch (contentType) {
    case "image/jpeg": return ".jpg";
    case "image/png": return ".png";
    case "image/webp": return ".webp";
    default: return "";
  }
}

export async function POST(req: NextRequest) {
  return withApiTenant(
    { roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      if (process.env.USE_S3 !== "true") {
        return NextResponse.json({ mode: "local" }, { status: 200 });
      }

      const body = await req.json().catch(() => ({}));
      const { contentType, referenceType, referenceId } = body;

      if (!contentType || !referenceType || !referenceId) {
        return NextResponse.json({ error: "contentType, referenceType, referenceId zorunludur." }, { status: 400 });
      }

      if (!ALLOWED_TYPES.includes(contentType)) {
        return NextResponse.json({ error: "Geçersiz dosya tipi." }, { status: 400 });
      }

      const ctx = getTenant();
      const factoryId = ctx.factoryId;
      if (!factoryId) {
        return NextResponse.json({ error: "Factory bağlamı bulunamadı." }, { status: 400 });
      }

      const ext = extFromMime(contentType);
      const filename = `${randomUUID()}${ext}`;
      const key = `${factoryId}/${referenceType.toLowerCase()}/${referenceId}/${filename}`;

      const { uploadUrl } = await generatePresignedUploadUrl(key);

      return NextResponse.json({ mode: "s3", uploadUrl, key });
    },
  );
}
