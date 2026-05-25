"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";
import { evaluateTrialImageEditability } from "@/lib/imageSizePolicy";
import { formatRelativeTime, formatTimestamp } from "@/lib/relativeTime";

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

type UploadSampleMetadataForm = {
  tNumber: string;
  specimenIdentifier: string;
  sliceIndex: string;
  replicate: string;
  treatmentReference: string;
  notes: string;
};

type UploadAcquisitionMetadataForm = {
  cameraDevice: string;
  lightingSetup: string;
  capturedBy: string;
  capturedAt: string;
  notes: string;
};

type UploadMetadataForm = {
  sample: UploadSampleMetadataForm;
  acquisition: UploadAcquisitionMetadataForm;
};

type UploadMetadataPayload = {
  sample?: Partial<Record<keyof UploadSampleMetadataForm, string>>;
  acquisition?: Partial<Record<keyof UploadAcquisitionMetadataForm, string>>;
};

const EMPTY_UPLOAD_METADATA: UploadMetadataForm = {
  sample: {
    tNumber: "",
    specimenIdentifier: "",
    sliceIndex: "",
    replicate: "",
    treatmentReference: "",
    notes: "",
  },
  acquisition: {
    cameraDevice: "",
    lightingSetup: "",
    capturedBy: "",
    capturedAt: "",
    notes: "",
  },
};

function formatBytes(size: number | null) {
  if (!size) return "size missing";
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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

function uploadMetadataForm() {
  return {
    sample: { ...EMPTY_UPLOAD_METADATA.sample },
    acquisition: { ...EMPTY_UPLOAD_METADATA.acquisition },
  };
}

function addCleanField<T extends string>(
  target: Partial<Record<T, string>>,
  field: T,
  value: string,
) {
  const trimmed = value.trim();
  if (trimmed) target[field] = trimmed;
}

function buildUploadMetadataPayload(form: UploadMetadataForm): UploadMetadataPayload | null {
  const sample: UploadMetadataPayload["sample"] = {};
  const acquisition: UploadMetadataPayload["acquisition"] = {};

  addCleanField(sample, "tNumber", form.sample.tNumber);
  addCleanField(sample, "specimenIdentifier", form.sample.specimenIdentifier);
  addCleanField(sample, "sliceIndex", form.sample.sliceIndex);
  addCleanField(sample, "replicate", form.sample.replicate);
  addCleanField(sample, "treatmentReference", form.sample.treatmentReference);
  addCleanField(sample, "notes", form.sample.notes);
  addCleanField(acquisition, "cameraDevice", form.acquisition.cameraDevice);
  addCleanField(acquisition, "lightingSetup", form.acquisition.lightingSetup);
  addCleanField(acquisition, "capturedBy", form.acquisition.capturedBy);
  addCleanField(acquisition, "capturedAt", form.acquisition.capturedAt);
  addCleanField(acquisition, "notes", form.acquisition.notes);

  const payload: UploadMetadataPayload = {};
  if (Object.keys(sample).length > 0) payload.sample = sample;
  if (Object.keys(acquisition).length > 0) payload.acquisition = acquisition;
  return Object.keys(payload).length > 0 ? payload : null;
}

function imageUpdatedValue(image: ImageRow, now: Date) {
  const value = image.updatedAt ?? image.uploadedAt ?? image.createdAt;
  return {
    label: formatRelativeTime(value, now),
    title: formatTimestamp(value),
  };
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

function ActionTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ImageListItem({
  image,
  projectId,
  now,
}: {
  image: ImageRow;
  projectId: string;
  now: Date;
}) {
  const router = useRouter();
  const editability = evaluateTrialImageEditability(image.width, image.height);
  const updated = imageUpdatedValue(image, now);
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
        <span className="text-[var(--text-secondary)]" title={updated.title}>
          {updated.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:col-start-2 2xl:col-auto 2xl:justify-end">
        <ActionTooltip label="Edit metadata">
          <Button asChild variant="outline" size="icon">
            <Link
              href={`/app/projects/${projectId}/images/${image.id}`}
              aria-label="Edit metadata"
            >
              <InfoIcon className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </ActionTooltip>
        {editability.status === "unsupported" ? (
          <ActionTooltip label="Trial editor supports images up to 8000 x 6000 pixels.">
            <span>
              <Button
                variant="outline"
                size="icon"
                disabled
                aria-label="Annotate image"
              >
                <PencilLineIcon className="size-4" aria-hidden="true" />
              </Button>
            </span>
          </ActionTooltip>
        ) : (
          <ActionTooltip label="Annotate image">
            <Button asChild size="icon">
              <Link href={openHref} aria-label="Annotate image">
                <PencilLineIcon className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </ActionTooltip>
        )}
      </div>
    </div>
  );
}

function UploadImageDialog({
  loading,
  onUpload,
}: {
  loading: boolean;
  onUpload: (file: File, metadata: UploadMetadataPayload | null) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<UploadMetadataForm>(() => uploadMetadataForm());

  function reset() {
    setFile(null);
    setForm(uploadMetadataForm());
  }

  function setSampleField(field: keyof UploadSampleMetadataForm, value: string) {
    setForm((current) => ({
      ...current,
      sample: { ...current.sample, [field]: value },
    }));
  }

  function setAcquisitionField(field: keyof UploadAcquisitionMetadataForm, value: string) {
    setForm((current) => ({
      ...current,
      acquisition: { ...current.acquisition, [field]: value },
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || loading) return;

    const ok = await onUpload(file, buildUploadMetadataPayload(form));
    if (!ok) return;
    reset();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (loading) return;
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <Button type="button" onClick={() => setOpen(true)} disabled={loading}>
        <UploadIcon className="size-4" aria-hidden="true" />
        <span>{loading ? "Uploading..." : "Upload image"}</span>
      </Button>
      <DialogContent className="max-h-[min(44rem,90dvh)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload image</DialogTitle>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="upload-image-file">Image file</Label>
            <Input
              id="upload-image-file"
              type="file"
              accept="image/*"
              disabled={loading}
              required
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
            />
          </div>

          <section className="grid gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Sample
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="upload-t-number">T-number</Label>
                <Input
                  id="upload-t-number"
                  value={form.sample.tNumber}
                  disabled={loading}
                  onChange={(event) => setSampleField("tNumber", event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="upload-specimen">Specimen identifier</Label>
                <Input
                  id="upload-specimen"
                  value={form.sample.specimenIdentifier}
                  disabled={loading}
                  onChange={(event) =>
                    setSampleField("specimenIdentifier", event.currentTarget.value)
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="upload-slice-index">Slice index</Label>
                <Input
                  id="upload-slice-index"
                  type="number"
                  min="0"
                  value={form.sample.sliceIndex}
                  disabled={loading}
                  onChange={(event) => setSampleField("sliceIndex", event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="upload-replicate">Replicate</Label>
                <Input
                  id="upload-replicate"
                  value={form.sample.replicate}
                  disabled={loading}
                  onChange={(event) => setSampleField("replicate", event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="upload-treatment">Treatment/reference</Label>
                <Input
                  id="upload-treatment"
                  value={form.sample.treatmentReference}
                  disabled={loading}
                  onChange={(event) =>
                    setSampleField("treatmentReference", event.currentTarget.value)
                  }
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="upload-sample-notes">Sample notes</Label>
                <Textarea
                  id="upload-sample-notes"
                  value={form.sample.notes}
                  disabled={loading}
                  onChange={(event) => setSampleField("notes", event.currentTarget.value)}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Acquisition
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="upload-camera">Camera/device</Label>
                <Input
                  id="upload-camera"
                  value={form.acquisition.cameraDevice}
                  disabled={loading}
                  onChange={(event) => setAcquisitionField("cameraDevice", event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="upload-lighting">Lighting setup</Label>
                <Input
                  id="upload-lighting"
                  value={form.acquisition.lightingSetup}
                  disabled={loading}
                  onChange={(event) => setAcquisitionField("lightingSetup", event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="upload-captured-by">Captured by</Label>
                <Input
                  id="upload-captured-by"
                  value={form.acquisition.capturedBy}
                  disabled={loading}
                  onChange={(event) => setAcquisitionField("capturedBy", event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="upload-captured-at">Captured at</Label>
                <Input
                  id="upload-captured-at"
                  type="datetime-local"
                  value={form.acquisition.capturedAt}
                  disabled={loading}
                  onChange={(event) => setAcquisitionField("capturedAt", event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="upload-acquisition-notes">Acquisition notes</Label>
                <Textarea
                  id="upload-acquisition-notes"
                  value={form.acquisition.notes}
                  disabled={loading}
                  onChange={(event) => setAcquisitionField("notes", event.currentTarget.value)}
                />
              </div>
            </div>
          </section>

          <DialogFooter>
            <Button type="submit" disabled={!file || loading}>
              <UploadIcon className="size-4" aria-hidden="true" />
              <span>{loading ? "Uploading..." : "Upload image"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
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

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  async function onUploadImage(file: File, metadata: UploadMetadataPayload | null) {
    setLoading(true);
    setError(null);
    setNotice(null);

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

      const imageId = typeof uploadData?.image?.id === "string" ? uploadData.image.id : null;
      let metadataWarning: string | null = null;

      if (metadata && imageId) {
        const metadataResponse = await fetch(`/api/images/${imageId}/metadata`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(metadata),
        });
        const metadataData = await metadataResponse.json().catch(() => null);
        if (!metadataResponse.ok) {
          metadataWarning = metadataData?.error ?? `METADATA_SAVE_FAILED_${metadataResponse.status}`;
        }
      } else if (metadata && !imageId) {
        metadataWarning = "METADATA_SAVE_SKIPPED";
      }

      await load();
      if (metadataWarning) {
        setNotice(`Image uploaded, but metadata was not saved: ${metadataWarning}`);
      }
      return true;
    } catch (e: unknown) {
      setError(errorMessage(e));
      return false;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <UploadImageDialog loading={loading} onUpload={onUploadImage} />
      )}

      {error && (
        <div className="rounded-md border border-[var(--state-blocked)] px-3 py-2 text-sm text-[var(--state-blocked)]">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-md border border-[var(--border-warning)] px-3 py-2 text-sm text-[var(--warning-text)]">
          {notice}
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
          <ImageListItem key={img.id} image={img} projectId={projectId} now={now} />
        ))}

        {images.length === 0 && (
          <AppEmptyState title="No images yet" description="Upload an image to start annotation work." />
        )}
      </div>
    </div>
  );
}
