"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  ImageIcon,
  InfoIcon,
  PencilLineIcon,
  UploadIcon,
} from "lucide-react";

import { AppEmptyState } from "@/components/shell/AppEmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
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
  updatedAt?: string | null;
  maskVersionCount?: number;
  sliceCount?: number;
};

function formatBytes(size: number | null) {
  if (!size) return "size missing";
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "date missing";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date missing";
  return date.toLocaleString();
}

function formatCount(value: number | undefined, singular: string, plural: string) {
  const count = value ?? 0;
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function metadataSummary(image: ImageRow) {
  const warnings = [];
  if (!image.width || !image.height) warnings.push("Missing dimensions");
  if (!image.checksum) warnings.push("Missing checksum");
  return warnings.length > 0 ? warnings.join(" · ") : "Technical metadata ready";
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("a,button,input,label,select,textarea"));
}

function statusClassName(status: ImageRow["validationStatus"]) {
  if (status === "VALIDATED") {
    return "border-[var(--state-ready)] text-[var(--state-ready)]";
  }
  if (status === "FAILED") {
    return "border-[var(--state-blocked)] text-[var(--state-blocked)]";
  }
  return "border-[var(--state-draft)] text-[var(--text-secondary)]";
}

function ImagePreview({ image }: { image: ImageRow }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm border border-[var(--border-subtle)] bg-[var(--workspace-surface-strong)] sm:w-32 2xl:w-24">
      {failed ? (
        <div className="flex size-full items-center justify-center text-[var(--text-muted)]">
          <ImageIcon className="size-5" aria-hidden="true" />
        </div>
      ) : (
        <Image
          src={`/api/images/${image.id}/asset`}
          alt={image.filename ?? "Image preview"}
          className="object-cover"
          fill
          loading="lazy"
          sizes="96px"
          unoptimized
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function ImageListItem({ image, projectId }: { image: ImageRow; projectId: string }) {
  const router = useRouter();
  const editability = evaluateTrialImageEditability(image.width, image.height);
  const updatedLabel = formatDate(image.updatedAt ?? image.uploadedAt ?? image.createdAt);
  const openHref = `/app/projects/${projectId}/images/${image.id}/crop`;
  const canOpenEditor = editability.status !== "unsupported";

  return (
    <div
      className={cn(
        "grid gap-4 rounded-sm border border-[var(--border-card)] bg-[var(--workspace-panel)] p-3 shadow-[var(--shadow-workspace-panel)] transition-colors hover:border-[var(--border-hover)] sm:grid-cols-[128px_minmax(0,1fr)] 2xl:grid-cols-[96px_minmax(0,1.35fr)_108px_78px_108px_142px_132px] 2xl:items-center",
        canOpenEditor ? "cursor-pointer" : "cursor-default",
      )}
      onClick={(event) => {
        if (!canOpenEditor || isInteractiveTarget(event.target)) return;
        router.push(openHref);
      }}
    >
      <ImagePreview image={image} />

      <div className="min-w-0">
        <div className="truncate font-medium text-[var(--text-primary)]">{image.filename ?? "filename missing"}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
          <span>{image.contentType ?? "type missing"}</span>
          <span>{formatBytes(image.size)}</span>
          <span>
            {image.width && image.height ? `${image.width} x ${image.height}` : "dimensions missing"}
          </span>
          <span>{image.uploadedBy?.name ?? image.uploadedBy?.email ?? "uploader missing"}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-sm border border-[var(--border-subtle)] px-2 py-1 text-[var(--text-secondary)]">
            T-number: {image.sampleMetadata?.tNumber ?? "missing"}
          </span>
          <span className="rounded-sm border border-[var(--border-subtle)] px-2 py-1 text-[var(--text-secondary)]">
            {metadataSummary(image)}
          </span>
          {editability.status === "large" && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--border-warning)] px-2 py-1 text-[var(--warning-text)]">
              <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
              Large image: iPad memory risk
            </span>
          )}
          {editability.status === "unsupported" && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--state-blocked)] px-2 py-1 text-[var(--state-blocked)]">
              <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
              Unsupported for trial editor
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:col-start-2 2xl:col-auto 2xl:block">
        <span className="text-xs font-semibold uppercase tracking-normal text-[var(--text-muted)] 2xl:hidden">
          Status
        </span>
        <span
          className={cn(
            "inline-flex rounded-sm border px-2 py-1 text-xs font-semibold",
            statusClassName(image.validationStatus),
          )}
        >
          {image.validationStatus}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm sm:col-start-2 2xl:col-auto 2xl:block">
        <span className="text-xs font-semibold uppercase tracking-normal text-[var(--text-muted)] 2xl:hidden">
          Slices
        </span>
        <span className="text-[var(--text-primary)]">{formatCount(image.sliceCount, "slice", "slices")}</span>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm sm:col-start-2 2xl:col-auto 2xl:block">
        <span className="text-xs font-semibold uppercase tracking-normal text-[var(--text-muted)] 2xl:hidden">
          Mask Versions
        </span>
        <span className="text-[var(--text-primary)]">{image.maskVersionCount ?? 0}</span>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm sm:col-start-2 2xl:col-auto 2xl:block">
        <span className="text-xs font-semibold uppercase tracking-normal text-[var(--text-muted)] 2xl:hidden">
          Updated
        </span>
        <span className="text-[var(--text-secondary)]">{updatedLabel}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:col-start-2 2xl:col-auto 2xl:justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/projects/${projectId}/images/${image.id}`}>
            <InfoIcon className="size-4" aria-hidden="true" />
            Metadata
          </Link>
        </Button>
        {editability.status === "unsupported" ? (
          <Button variant="outline" size="sm" disabled title="Trial editor supports images up to 8000 x 6000 pixels.">
            <PencilLineIcon className="size-4" aria-hidden="true" />
            Open
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href={openHref}>
              <PencilLineIcon className="size-4" aria-hidden="true" />
              Open
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
  const loadRequestId = useRef(0);

  async function load() {
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/images`, {
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (requestId !== loadRequestId.current) return;

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
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--workspace-panel)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--workspace-panel-hover)]">
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

      {error && (
        <div className="rounded-md border border-[var(--state-blocked)] px-3 py-2 text-sm text-[var(--state-blocked)]">
          {error}
        </div>
      )}

      <div className="hidden rounded-sm border border-[var(--border-subtle)] bg-[var(--workspace-surface)] px-3 py-2 text-[9px] font-bold uppercase tracking-normal text-[var(--text-dim)] 2xl:grid 2xl:grid-cols-[96px_minmax(0,1.35fr)_108px_78px_108px_142px_132px]">
        <span>Preview</span>
        <span>Image / Filename</span>
        <span>Status</span>
        <span>Slices</span>
        <span>Mask Versions</span>
        <span>Updated</span>
        <span className="text-right">Actions</span>
      </div>

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
