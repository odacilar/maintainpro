"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

interface PhotoRecord {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

interface PhotoUploadProps {
  referenceType: string;
  referenceId: string;
  /** Maximum number of photos allowed. Defaults to unlimited. */
  maxPhotos?: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PhotoUpload({
  referenceType,
  referenceId,
  maxPhotos,
  className = "",
}: PhotoUploadProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const queryKey = ["photos", referenceType, referenceId];

  // Fetch existing photos
  const { data: photos = [], isLoading } = useQuery<PhotoRecord[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/photos?referenceType=${encodeURIComponent(referenceType)}&referenceId=${encodeURIComponent(referenceId)}`,
      );
      if (!res.ok) throw new Error("Fotoğraflar yüklenemedi.");
      return res.json();
    },
    enabled: !!referenceId,
  });

  // Upload mutation — tries presigned S3 PUT first, falls back to multipart
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadProgress(0);

      // 1) Ask server for presigned URL
      const presignRes = await fetch("/api/photos/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, referenceType, referenceId }),
      });
      const presignData = await presignRes.json().catch(() => ({ mode: "local" }));

      if (presignRes.ok && presignData.mode === "s3") {
        // 2a) Direct S3 upload via presigned PUT
        return new Promise<PhotoRecord>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", presignData.uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          };

          xhr.onload = async () => {
            setUploadProgress(null);
            if (xhr.status >= 200 && xhr.status < 300) {
              // 3) Confirm upload with server
              const confirmRes = await fetch("/api/photos/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  key: presignData.key,
                  contentType: file.type,
                  sizeBytes: file.size,
                  referenceType,
                  referenceId,
                }),
              });
              if (confirmRes.ok) {
                resolve(await confirmRes.json());
              } else {
                const body = await confirmRes.json().catch(() => ({}));
                reject(new Error(body.error ?? "Kayıt oluşturulamadı."));
              }
            } else {
              reject(new Error("S3 yükleme başarısız oldu."));
            }
          };

          xhr.onerror = () => {
            setUploadProgress(null);
            reject(new Error("Ağ hatası oluştu."));
          };

          xhr.send(file);
        });
      }

      // 2b) Fallback: multipart upload through server
      const body = new FormData();
      body.append("file", file);
      body.append("referenceType", referenceType);
      body.append("referenceId", referenceId);

      return new Promise<PhotoRecord>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/photos/upload");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };

        xhr.onload = () => {
          setUploadProgress(null);
          if (xhr.status === 201) {
            resolve(JSON.parse(xhr.responseText) as PhotoRecord);
          } else {
            const errBody = JSON.parse(xhr.responseText ?? "{}");
            reject(new Error(errBody.error ?? "Yükleme başarısız oldu."));
          }
        };

        xhr.onerror = () => {
          setUploadProgress(null);
          reject(new Error("Ağ hatası oluştu."));
        };

        xhr.send(body);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Silme işlemi başarısız oldu.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // ---------------------------------------------------------------------------
  // File validation + upload
  // ---------------------------------------------------------------------------

  const handleFiles = useCallback(
    (files: FileList | null) => {
      setValidationError(null);
      if (!files || files.length === 0) return;

      const file = files[0];

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setValidationError("Yalnızca JPEG, PNG ve WebP dosyaları kabul edilmektedir.");
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        setValidationError("Dosya boyutu 10 MB'ı aşamaz.");
        return;
      }

      if (maxPhotos !== undefined && photos.length >= maxPhotos) {
        setValidationError(`En fazla ${maxPhotos} fotoğraf yükleyebilirsiniz.`);
        return;
      }

      uploadMutation.mutate(file);
    },
    [photos.length, maxPhotos, uploadMutation],
  );

  // ---------------------------------------------------------------------------
  // Drag & drop handlers
  // ---------------------------------------------------------------------------

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const atLimit = maxPhotos !== undefined && photos.length >= maxPhotos;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop zone */}
      {!atLimit && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Fotoğraf yükle"
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 transition-colors cursor-pointer
            ${isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40"
            }
            ${uploadMutation.isPending ? "pointer-events-none opacity-60" : ""}
          `}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="text-center">
            <p className="text-sm font-medium">
              {uploadMutation.isPending
                ? `Yükleniyor${uploadProgress !== null ? ` (${uploadProgress}%)` : ""}…`
                : "Fotoğraf Yükle"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Sürükle bırak veya tıklayın — JPEG, PNG, WebP · Maks. 10 MB
            </p>
          </div>

          {/* Progress bar */}
          {uploadProgress !== null && (
            <div className="w-full max-w-xs">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploadMutation.isPending}
      />

      {/* Validation error */}
      {validationError && (
        <p className="text-xs text-destructive">{validationError}</p>
      )}

      {/* Upload error */}
      {uploadMutation.isError && (
        <p className="text-xs text-destructive">
          {(uploadMutation.error as Error).message}
        </p>
      )}

      {/* Delete error */}
      {deleteMutation.isError && (
        <p className="text-xs text-destructive">
          {(deleteMutation.error as Error).message}
        </p>
      )}

      {/* Photo thumbnails */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Fotoğraflar yükleniyor…
        </div>
      ) : photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt="Fotoğraf"
                className="h-full w-full object-cover"
                loading="lazy"
              />

              {/* Overlay with delete button */}
              <div className="absolute inset-0 flex items-start justify-end bg-black/0 p-1 transition-colors group-hover:bg-black/30">
                <button
                  aria-label="Fotoğrafı sil"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white opacity-0 shadow transition-opacity group-hover:opacity-100 hover:bg-destructive/80"
                  onClick={() => deleteMutation.mutate(photo.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              </div>

              {/* Size label */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                {formatBytes(photo.sizeBytes)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !isLoading && (
          <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed py-6 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <p className="text-xs">Henüz fotoğraf yok</p>
          </div>
        )
      )}

      {/* Count indicator */}
      {maxPhotos !== undefined && (
        <p className="text-right text-xs text-muted-foreground">
          {photos.length} / {maxPhotos}
        </p>
      )}
    </div>
  );
}
