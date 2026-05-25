"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCwIcon, SquareMousePointerIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import type {
  CropSliceNavigatorModel,
  CropSliceNavigatorSlice,
} from "@/server/domain/cropSliceNavigator";
import { API_ENSURE_SLICE_CROPS } from "./editorApi";
import { formatToken } from "./ImageCropSliceNavigatorClient";

type CropEditorMode = "editor" | "support" | "semantic";

type EnsuredCrop = {
  id: string;
  sliceInstanceId: string;
};

function cropEditorHref(params: {
  navigator: CropSliceNavigatorModel;
  sliceInstanceId: string;
  cropId: string;
  editorMode: CropEditorMode;
}) {
  const base =
    `/app/projects/${params.navigator.projectId}/images/${params.navigator.imageId}` +
    `/crop/slices/${params.sliceInstanceId}/crops/${params.cropId}`;
  return params.editorMode === "editor" ? base : `${base}/${params.editorMode}`;
}

function currentEditorHref(
  navigator: CropSliceNavigatorModel,
  slice: CropSliceNavigatorSlice,
  editorMode: CropEditorMode,
) {
  if (!slice.currentCrop) return null;
  return cropEditorHref({
    navigator,
    sliceInstanceId: slice.sliceInstanceId,
    cropId: slice.currentCrop.id,
    editorMode,
  });
}

function compactSliceStatus(slice: CropSliceNavigatorSlice) {
  if (slice.readinessStatus === "READY") return "Ready";
  if (slice.readinessStatus === "REVIEW_REQUIRED") return "Review required";
  if (slice.cropStatus === "STALE") return "Update crop";
  if (slice.cropStatus === "MISSING") return "Missing crop";
  return formatToken(slice.cropStatus);
}

function compactSliceStatusClass(slice: CropSliceNavigatorSlice) {
  if (slice.readinessStatus === "READY") {
    return "border-[var(--state-ready)] bg-[var(--workspace-panel)] text-[var(--text-primary)]";
  }
  if (slice.readinessStatus === "REVIEW_REQUIRED" || slice.cropStatus === "STALE") {
    return "border-[var(--border-warning)] bg-[var(--warning-surface)] text-[var(--warning-text)]";
  }
  return "border-[var(--border-subtle)] bg-[var(--workspace-panel)] text-[var(--text-secondary)]";
}

export function CropEditorSliceNavigatorRailClient({
  navigator,
  editorMode,
}: {
  navigator: CropSliceNavigatorModel;
  editorMode: CropEditorMode;
}) {
  const router = useRouter();
  const [busySliceId, setBusySliceId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const selectedSlice = useMemo(
    () =>
      navigator.slices.find((slice) => slice.sliceInstanceId === navigator.selectedSliceInstanceId) ??
      navigator.slices[0] ??
      null,
    [navigator.selectedSliceInstanceId, navigator.slices],
  );

  async function openSlice(slice: CropSliceNavigatorSlice) {
    const existingHref = currentEditorHref(navigator, slice, editorMode);
    if (existingHref) {
      router.push(existingHref);
      return;
    }

    setBusySliceId(slice.sliceInstanceId);
    setStatus("");
    try {
      const response = await fetch(API_ENSURE_SLICE_CROPS(navigator.imageId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sliceInstanceId: slice.sliceInstanceId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? `SLICE_CROP_ENSURE_FAILED_${response.status}`);
      }
      const crop = (data.crops as EnsuredCrop[] | undefined)?.find(
        (entry) => entry.sliceInstanceId === slice.sliceInstanceId,
      );
      if (!crop) throw new Error("SLICE_CROP_ENSURE_MISSING_CROP");
      router.push(
        cropEditorHref({
          navigator,
          sliceInstanceId: slice.sliceInstanceId,
          cropId: crop.id,
          editorMode,
        }),
      );
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Slice crop navigation failed");
    } finally {
      setBusySliceId(null);
    }
  }

  return (
    <aside aria-label="Slice navigator" className="min-w-0 space-y-4">
      <div className="space-y-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--text-dim)]">
            Slices
          </div>
          <div className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">
            {navigator.summary.totalSlices} slices · {navigator.summary.currentCropCount} current ·{" "}
            {navigator.summary.readyCount} ready
          </div>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full rounded-sm border-[var(--border-subtle)] bg-[var(--workspace-panel)] text-[var(--text-primary)] hover:bg-[var(--workspace-panel-hover)]"
        >
          <Link href={navigator.routes.bboxesHref}>
            <SquareMousePointerIcon className="size-4" aria-hidden="true" />
            Edit BBoxes
          </Link>
        </Button>

        <div className="relative overflow-hidden border border-[var(--border-subtle)] bg-[var(--workspace-panel)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={navigator.image.assetUrl}
            alt={`Slice navigator for ${navigator.image.filename ?? navigator.image.id}`}
            className="block h-auto w-full"
          />
          <div className="absolute inset-0">
            {navigator.slices.map((slice) => {
              const selected = slice.sliceInstanceId === selectedSlice?.sliceInstanceId;
              const busy = busySliceId === slice.sliceInstanceId;
              return (
                <button
                  key={slice.sliceInstanceId}
                  type="button"
                  aria-label={`Open ${slice.label}`}
                  aria-current={selected ? "page" : undefined}
                  onClick={() => void openSlice(slice)}
                  className={cn(
                    "absolute flex items-start justify-start border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                    selected
                      ? "border-[var(--accent-primary)] bg-[var(--workspace-selected)]"
                      : "border-[var(--border-hover)] bg-[var(--workspace-panel)] hover:bg-[var(--workspace-panel-hover)]",
                    busy && "cursor-wait",
                  )}
                  style={{
                    left: `${slice.sourceRectPercent.left}%`,
                    top: `${slice.sourceRectPercent.top}%`,
                    width: `${slice.sourceRectPercent.width}%`,
                    height: `${slice.sourceRectPercent.height}%`,
                  }}
                >
                  <span className="m-1 rounded-sm border border-[var(--border-subtle)] bg-[var(--workspace-input-background)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-primary)]">
                    {busy ? <RefreshCwIcon className="size-3 animate-spin" aria-hidden="true" /> : slice.index}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {status && (
        <div className="border border-[var(--border-subtle)] px-3 py-2 text-[11px] text-[var(--text-secondary)]" role="status">
          {status}
        </div>
      )}

      <div className="space-y-1.5">
        {navigator.slices.map((slice) => {
          const selected = slice.sliceInstanceId === selectedSlice?.sliceInstanceId;
          const busy = busySliceId === slice.sliceInstanceId;
          return (
            <button
              key={slice.sliceInstanceId}
              type="button"
              onClick={() => void openSlice(slice)}
              className={cn(
                "block w-full border px-2.5 py-2 text-left text-[12px] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--workspace-panel-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                selected
                  ? "border-[var(--accent-primary)] bg-[var(--workspace-selected)]"
                  : "border-[var(--border-subtle)] bg-[var(--workspace-panel)]",
                busy && "cursor-wait",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 font-semibold text-[var(--text-primary)]">
                  #{slice.index}
                  <span className="ml-2 font-medium text-[var(--text-secondary)]">{slice.label}</span>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                    compactSliceStatusClass(slice),
                  )}
                >
                  {busy ? "Ensuring" : compactSliceStatus(slice)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => router.refresh()}
        className="w-full rounded-sm border-[var(--border-subtle)] bg-[var(--workspace-panel)] text-[var(--text-secondary)] hover:bg-[var(--workspace-panel-hover)]"
      >
        <RefreshCwIcon className="size-4" aria-hidden="true" />
        Refresh navigator
      </Button>
    </aside>
  );
}
