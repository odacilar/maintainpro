/**
 * Storage Service — local filesystem (dev) or AWS S3 (production)
 *
 * Behaviour is controlled by the USE_S3 environment variable:
 *   USE_S3=true  → S3 presigned URLs (requires AWS_REGION, S3_BUCKET, AWS credentials)
 *   (unset)      → local filesystem under public/uploads/ — works without AWS
 */

import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";

export interface UploadResult {
  key: string;
  url: string;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extFromMime(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// S3 helpers — lazy-loaded so the app starts without AWS credentials in dev
// ---------------------------------------------------------------------------

async function getS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({ region: process.env.AWS_REGION ?? "eu-central-1" });
}

/**
 * Generate a presigned PUT URL for direct-to-S3 browser upload.
 * Expiry: 15 minutes.
 */
export async function generatePresignedUploadUrl(
  key: string,
): Promise<{ uploadUrl: string; key: string }> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = await getS3Client();

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });
  return { uploadUrl, key };
}

/**
 * Generate a presigned GET URL so stored photos can be served privately.
 * Expiry: 15 minutes.
 */
export async function generatePresignedDownloadUrl(key: string): Promise<string> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = await getS3Client();

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: 900 });
}

// ---------------------------------------------------------------------------
// Local storage — saves under public/uploads/ so Next.js serves them as-is
// ---------------------------------------------------------------------------

/**
 * Persist a file to the local filesystem and return a result with a public URL.
 *
 * @param file          Raw buffer containing the file content
 * @param contentType   MIME type (e.g. "image/jpeg")
 * @param referenceType Domain entity type (e.g. "machine", "breakdown")
 * @param referenceId   ID of the related entity
 */
export async function uploadLocal(
  file: Buffer,
  contentType: string,
  referenceType: string,
  referenceId: string,
): Promise<UploadResult> {
  const ext = extFromMime(contentType);
  const filename = `${randomUUID()}${ext}`;
  const relDir = `uploads/${referenceType}/${referenceId}`;
  const absDir = path.join(process.cwd(), "public", relDir);

  await fs.mkdir(absDir, { recursive: true });
  const absPath = path.join(absDir, filename);
  await fs.writeFile(absPath, file);

  const key = `${relDir}/${filename}`;
  return {
    key,
    url: `/${key}`,
    sizeBytes: file.length,
  };
}

/**
 * Upload to S3 and return the key + public (or presigned) URL.
 *
 * @param file          Raw buffer containing the file content
 * @param contentType   MIME type
 * @param factoryId     Tenant ID — top-level S3 prefix
 * @param referenceType Domain entity type
 * @param referenceId   ID of the related entity
 */
export async function uploadToS3(
  file: Buffer,
  contentType: string,
  factoryId: string,
  referenceType: string,
  referenceId: string,
): Promise<UploadResult> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await getS3Client();

  const ext = extFromMime(contentType);
  const filename = `${randomUUID()}${ext}`;
  const key = `${factoryId}/${referenceType}/${referenceId}/${filename}`;

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: file,
      ContentType: contentType,
    }),
  );

  // Return the presigned download URL so the caller can store it or relay it
  const url = await generatePresignedDownloadUrl(key);
  return { key, url, sizeBytes: file.length };
}

/**
 * Unified upload — delegates to local or S3 depending on USE_S3 env flag.
 */
export async function uploadFile(
  file: Buffer,
  contentType: string,
  referenceType: string,
  referenceId: string,
  factoryId?: string,
): Promise<UploadResult> {
  if (process.env.USE_S3 === "true") {
    if (!factoryId) throw new Error("factoryId is required for S3 uploads");
    return uploadToS3(file, contentType, factoryId, referenceType, referenceId);
  }
  return uploadLocal(file, contentType, referenceType, referenceId);
}

/**
 * Delete a file (local or S3).
 */
export async function deleteFile(key: string): Promise<void> {
  if (process.env.USE_S3 === "true") {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    await client.send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
    );
    return;
  }

  // Local: key is the relative path under public/
  const absPath = path.join(process.cwd(), "public", key);
  await fs.unlink(absPath).catch(() => {
    // Silently ignore if the file is already missing
  });
}

/**
 * Resolve a stored key to a URL that the browser can use.
 * In local mode the key IS the URL (e.g. "uploads/machine/abc/photo.jpg" → "/uploads/…").
 * In S3 mode we generate a fresh presigned GET URL.
 */
export async function resolveUrl(key: string): Promise<string> {
  if (process.env.USE_S3 === "true") {
    return generatePresignedDownloadUrl(key);
  }
  return key.startsWith("/") ? key : `/${key}`;
}
