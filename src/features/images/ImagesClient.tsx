"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon, InfoIcon, PencilLineIcon, UploadIcon } from "lucide-react";

import { AppEmptyState } from "@/components/shell/AppEmptyState";
import { Button } from "@/components/ui/button";
import { evaluateTrialImageEditability } from "@/lib/imageSizePolicy";

function errorMessage(error: unknown, fallback = "ERROR") {
  return error instanceof Error ? error.message : fallback;
}

function uploadErrorMessage(code: string) {
  if (code === "IMAGE_DIMENSIONS_UNSUPPORTED") {
    return "Image is too large for the trial editor. Use an image up to 8000 x 6000 pixels.";
  }
  if (code === "UPLOAD_TOO_LARGE") {
    return "Upload is larger than the configured trial limit.";
  }
  return code;
}

type ImageRow = {
  id: string;
  filename: string | null;
  contentType: string | null;
  size: number | null;
  checksum: string | null;
  width: number | null;
  height: number | null;
  validationStatus: "PENDING" | "VALIDATED" | "FAILED";
  uploadedAt: string;
  uploadedBy: { email: string; name: string | null } | null;
  sampleMetadata: { tNumber: string | null } | null;
  createdAt: string;
};

function formatBytes(size: number | null) {
  if (!size) return "size missing";
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date missing";
  return date.toLocaleString();
}

function metadataSummary(image: ImageRow) {
  const warnings = [];
  if (!image.width || !image.height) warnings.push("Missing dimensions");
  if (!image.checksum) warnings.push("Missing checksum");
  return warnings.length > 0 ? warnings.join(" · ") : "Technical metadata ready";
}

function ImageListItem({ image, projectId }: { image: ImageRow; projectId: string }) {
  const editability = evaluateTrialImageEditability(image.width, image.height);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{image.filename}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{image.contentType ?? "type missing"}</span>
          <span>{formatBytes(image.size)}</span>
          <span>{image.width && image.height ? `${image.width} x ${image.height}` : "dimensions missing"}</span>
          <span>{image.validationStatus}</span>
          <span>Uploaded {formatDate(image.uploadedAt ?? image.createdAt)}</span>
          <span>{image.uploadedBy?.name ?? image.uploadedBy?.email ?? "uploader missing"}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">
            T-number: {image.sampleMetadata?.tNumber ?? "missing"}
          </span>
          <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">
            {metadataSummary(image)}
          </span>
          {editability.status === "large" && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground">
              <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
              Large image: iPad memory risk
            </span>
          )}
          {editability.status === "unsupported" && (
            <span className="inline-flex items-center gap-1 rounded-md border border-destructive/50 px-2 py-1 text-destructive">
              <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
              Unsupported for trial editor
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/projects/${projectId}/images/${image.id}`}>
            <InfoIcon className="size-4" aria-hidden="true" />
            Metadata
          </Link>
        </Button>
        {editability.status === "unsupported" ? (
          <Button variant="outline" size="sm" disabled title="Trial editor supports images up to 8000 x 6000 pixels.">
            <PencilLineIcon className="size-4" aria-hidden="true" />
            Open editor
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/projects/${projectId}/images/${image.id}/edit`}>
              <PencilLineIcon className="size-4" aria-hidden="true" />
              Open editor
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function ImagesClient({
  projectId,
  canUpload,
}: {
  projectId: string;
  canUpload: boolean;
}) {
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/images`, {
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setImages([]);
      setError(data?.error ?? `LOAD_FAILED_${res.status}`);
      return;
    }

    setImages(Array.isArray(data?.images) ? data.images : []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function onPickFile(file: File) {
    setLoading(true);
    setError(null);

    try {
      const upload = await fetch(`/api/projects/${projectId}/images/upload`, {
        method: "POST",
        headers: {
          "content-type": file.type || "application/octet-stream",
          "x-filename": encodeURIComponent(file.name),
        },
        body: file,
      });

      const uploadData = await upload.json().catch(() => null);
      if (!upload.ok) throw new Error(uploadErrorMessage(uploadData?.error ?? `UPLOAD_FAILED_${upload.status}`));

      await load();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickFile(f);
              e.currentTarget.value = "";
            }}
          />
          <UploadIcon className="size-4" aria-hidden="true" />
          <span>{loading ? "Uploading..." : "Upload image"}</span>
        </label>
      )}

      {error && <div className="rounded-lg border border-destructive px-3 py-2 text-sm text-destructive">{error}</div>}

      <div className="grid gap-2">
        {images.map((img) => (
          <ImageListItem key={img.id} image={img} projectId={projectId} />
        ))}

        {images.length === 0 && (
          <AppEmptyState title="No images yet" description="Upload an image to start annotation work." />
        )}
      </div>
    </div>
  );
}
