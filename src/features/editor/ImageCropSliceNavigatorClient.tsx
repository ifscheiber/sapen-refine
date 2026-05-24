"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilLineIcon, RefreshCwIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import type {
  CropSliceNavigatorModel,
  CropSliceNavigatorSlice,
} from "@/server/domain/cropSliceNavigator";
import { API_GENERATE_SLICE_CROP } from "./editorApi";

export function formatToken(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatClassName(value: string | null) {
  if (!value) return "Missing";
  if (value === "SAP_HEARTWOOD_SLICE") return "Sap/Heartwood";
  if (value === "COPPER_SLICE") return "Copper";
  if (value === "REVIEW_REQUIRED") return "Review required";
  return formatToken(value);
}

export function badgeClass(kind: "neutral" | "good" | "warn" | "bad") {
  return cn(
    "inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-xs font-medium",
    kind === "good" && "border-border bg-accent text-accent-foreground",
    kind === "warn" && "border-border bg-muted text-foreground",
    kind === "bad" && "border-destructive/40 bg-destructive/10 text-destructive",
    kind === "neutral" && "border-border bg-background text-muted-foreground",
  );
}

export function cropBadgeKind(status: CropSliceNavigatorSlice["cropStatus"]) {
  if (status === "CURRENT") return "good";
  if (status === "STALE") return "warn";
  return "neutral";
}

function reviewBadgeKind(status: string) {
  if (status === "APPROVED" || status === "READY") return "good";
  if (status === "REJECTED" || status === "REVIEW_REQUIRED" || status === "STALE") return "bad";
  if (status === "SUBMITTED" || status === "PARTIAL") return "warn";
  return "neutral";
}

function StatusBadge({
  label,
  value,
  kind,
}: {
  label: string;
  value: string;
  kind?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <span className={badgeClass(kind ?? reviewBadgeKind(value))}>
      {label}: {formatToken(value)}
    </span>
  );
}

export function SliceStatusBadges({ slice }: { slice: CropSliceNavigatorSlice }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge label="BBox" value={slice.bboxStatus} kind="good" />
      <StatusBadge label="Crop" value={slice.cropStatus} kind={cropBadgeKind(slice.cropStatus)} />
      <StatusBadge label="Support" value={slice.supportStatus} />
      <StatusBadge label="Semantic" value={slice.semanticStatus} />
      <StatusBadge label="Class" value={slice.classificationStatus} />
      <StatusBadge label="Ready" value={slice.readinessStatus} />
    </div>
  );
}

function SliceCard({
  slice,
  selected,
}: {
  slice: CropSliceNavigatorSlice;
  selected: boolean;
}) {
  return (
    <Link
      href={slice.selectedHref}
      className={cn(
        "block rounded-md border p-3 text-sm transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-ring bg-accent/60" : "border-border bg-background",
      )}
      aria-current={selected ? "page" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{slice.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            x {slice.sourceRect.x}, y {slice.sourceRect.y}, {slice.sourceRect.width} x {slice.sourceRect.height}, BBox v
            {slice.bboxVersion}
          </div>
        </div>
        <span className={badgeClass(cropBadgeKind(slice.cropStatus))}>{formatToken(slice.cropStatus)}</span>
      </div>
      <div className="mt-3">
        <SliceStatusBadges slice={slice} />
      </div>
    </Link>
  );
}

function SelectedSlicePanel({
  slice,
  canGenerateCrop,
  busy,
  onGenerateCrop,
}: {
  slice: CropSliceNavigatorSlice;
  canGenerateCrop: boolean;
  busy: boolean;
  onGenerateCrop: (slice: CropSliceNavigatorSlice) => void;
}) {
  const cropAction = slice.cropStatus === "CURRENT" ? "Regenerate crop" : "Generate crop";

  return (
    <div className="rounded-lg border border-border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{slice.label}</h2>
          <p className="mt-1 text-muted-foreground">
            Source x {slice.sourceRect.x}, y {slice.sourceRect.y}, {slice.sourceRect.width} x {slice.sourceRect.height}.
          </p>
        </div>
        <span className={badgeClass(reviewBadgeKind(slice.readinessStatus))}>
          {formatToken(slice.readinessStatus)}
        </span>
      </div>

      <div className="mt-4">
        <SliceStatusBadges slice={slice} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Crop</dt>
          <dd className="font-medium">
            {slice.currentCrop
              ? `v${slice.currentCrop.version}, ${slice.currentCrop.cropWidth} x ${slice.currentCrop.cropHeight}`
              : slice.latestCrop
                ? `Stale v${slice.latestCrop.version}`
                : "Missing"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Semantic family</dt>
          <dd className="font-medium">{slice.semanticMode ? formatToken(slice.semanticMode) : "Unset"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Classification</dt>
          <dd className="font-medium">
            {formatClassName(slice.classificationClass)}
            {slice.classificationSource ? ` · ${formatToken(slice.classificationSource)}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Next action</dt>
          <dd className="font-medium">
            {slice.cropStatus === "MISSING" || slice.cropStatus === "STALE"
              ? cropAction
              : slice.nextActions[0]
                ? formatToken(slice.nextActions[0])
                : "Review readiness"}
          </dd>
        </div>
      </dl>

      {slice.readinessReasons.length > 0 && (
        <div className="mt-4 rounded-md border border-border px-3 py-2 text-muted-foreground">
          {slice.readinessReasons.slice(0, 3).map(formatToken).join(", ")}
          {slice.readinessReasons.length > 3 ? ", ..." : ""}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => onGenerateCrop(slice)}
          disabled={!canGenerateCrop || busy}
          variant={slice.cropStatus === "CURRENT" ? "outline" : "default"}
        >
          <RefreshCwIcon className={cn("size-4", busy && "animate-spin")} aria-hidden="true" />
          {busy ? "Generating..." : cropAction}
        </Button>
        {slice.workbenchHref ? (
          <Button asChild variant="outline">
            <Link href={slice.workbenchHref}>
              <PencilLineIcon className="size-4" aria-hidden="true" />
              Open editor
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled>
            <PencilLineIcon className="size-4" aria-hidden="true" />
            Editor needs crop
          </Button>
        )}
      </div>
    </div>
  );
}

export function ImageCropSliceNavigatorClient({
  navigator,
}: {
  navigator: CropSliceNavigatorModel;
}) {
  const router = useRouter();
  const [busySliceId, setBusySliceId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const selectedSlice = useMemo(
    () =>
      navigator.slices.find((slice) => slice.sliceInstanceId === navigator.selectedSliceInstanceId) ??
      navigator.slices[0],
    [navigator.selectedSliceInstanceId, navigator.slices],
  );

  async function generateCrop(slice: CropSliceNavigatorSlice) {
    setBusySliceId(slice.sliceInstanceId);
    setStatus("");
    try {
      const response = await fetch(API_GENERATE_SLICE_CROP(slice.bboxVersionId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? `SLICE_CROP_FAILED_${response.status}`);
      }
      setStatus(`${slice.label} crop generated`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Crop generation failed");
    } finally {
      setBusySliceId(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
      <section aria-label="Whole-image slice navigator" className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{navigator.summary.totalSlices} slices</span>
          <span>{navigator.summary.currentCropCount} current crops</span>
          <span>{navigator.summary.staleCropCount} stale crops</span>
          <span>{navigator.summary.readyCount} export-ready</span>
        </div>
        <div className="relative overflow-hidden rounded-lg border border-border bg-muted/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={navigator.image.assetUrl}
            alt={`Whole image context for ${navigator.image.filename ?? navigator.image.id}`}
            className="block h-auto w-full"
          />
          <div className="absolute inset-0">
            {navigator.slices.map((slice) => {
              const selected = slice.sliceInstanceId === selectedSlice.sliceInstanceId;
              return (
                <Link
                  key={slice.sliceInstanceId}
                  href={slice.selectedHref}
                  aria-label={`Select ${slice.label}`}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "absolute flex items-start justify-start border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "border-ring bg-ring/20" : "border-primary bg-primary/10 hover:bg-primary/20",
                  )}
                  style={{
                    left: `${slice.sourceRectPercent.left}%`,
                    top: `${slice.sourceRectPercent.top}%`,
                    width: `${slice.sourceRectPercent.width}%`,
                    height: `${slice.sourceRectPercent.height}%`,
                  }}
                >
                  <span className="m-1 rounded-sm bg-background/90 px-1.5 py-0.5 text-xs font-medium text-foreground shadow-sm">
                    {slice.index}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <aside aria-label="Slice status list" className="min-w-0 space-y-3">
        {status && (
          <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground" role="status">
            {status}
          </div>
        )}
        {selectedSlice && (
          <SelectedSlicePanel
            slice={selectedSlice}
            canGenerateCrop={navigator.canGenerateCrop}
            busy={busySliceId === selectedSlice.sliceInstanceId}
            onGenerateCrop={generateCrop}
          />
        )}
        <div className="space-y-2">
          {navigator.slices.map((slice) => (
            <SliceCard
              key={slice.sliceInstanceId}
              slice={slice}
              selected={slice.sliceInstanceId === selectedSlice?.sliceInstanceId}
            />
          ))}
        </div>
      </aside>
    </div>
  );
}
