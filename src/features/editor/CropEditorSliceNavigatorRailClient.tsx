"use client";

import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import type {
  CropSliceNavigatorModel,
  CropSliceNavigatorSlice,
} from "@/server/domain/cropSliceNavigator";
import { API_ENSURE_SLICE_CROPS } from "./editorApi";
import {
  badgeClass,
  cropBadgeKind,
  formatToken,
  SliceStatusBadges,
} from "./ImageCropSliceNavigatorClient";

type CropEditorMode = "support" | "semantic";

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
  return (
    `/app/projects/${params.navigator.projectId}/images/${params.navigator.imageId}` +
    `/slices/${params.sliceInstanceId}/crops/${params.cropId}/${params.editorMode}`
  );
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
    <aside aria-label="Slice navigator" className="min-w-0 space-y-3">
      <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{navigator.summary.totalSlices} slices</span>
          <span>{navigator.summary.currentCropCount} current</span>
          <span>{navigator.summary.readyCount} ready</span>
        </div>
        <div className="relative overflow-hidden rounded-md border border-border bg-muted/20">
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
                    "absolute flex items-start justify-start border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "border-ring bg-ring/20" : "border-primary bg-primary/10 hover:bg-primary/20",
                    busy && "cursor-wait",
                  )}
                  style={{
                    left: `${slice.sourceRectPercent.left}%`,
                    top: `${slice.sourceRectPercent.top}%`,
                    width: `${slice.sourceRectPercent.width}%`,
                    height: `${slice.sourceRectPercent.height}%`,
                  }}
                >
                  <span className="m-1 rounded-sm bg-background/90 px-1.5 py-0.5 text-xs font-medium text-foreground shadow-sm">
                    {busy ? <RefreshCwIcon className="size-3 animate-spin" aria-hidden="true" /> : slice.index}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {status && (
        <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground" role="status">
          {status}
        </div>
      )}

      <div className="space-y-2">
        {navigator.slices.map((slice) => {
          const selected = slice.sliceInstanceId === selectedSlice?.sliceInstanceId;
          const busy = busySliceId === slice.sliceInstanceId;
          return (
            <button
              key={slice.sliceInstanceId}
              type="button"
              onClick={() => void openSlice(slice)}
              className={cn(
                "block w-full rounded-md border p-3 text-left text-sm transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-ring bg-accent/60" : "border-border bg-background",
                busy && "cursor-wait",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{slice.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    x {slice.sourceRect.x}, y {slice.sourceRect.y}, {slice.sourceRect.width} x{" "}
                    {slice.sourceRect.height}
                  </div>
                </div>
                <span className={badgeClass(cropBadgeKind(slice.cropStatus))}>
                  {busy ? "Ensuring" : formatToken(slice.cropStatus)}
                </span>
              </div>
              <div className="mt-3">
                <SliceStatusBadges slice={slice} />
              </div>
            </button>
          );
        })}
      </div>

      <Button type="button" variant="outline" onClick={() => router.refresh()} className="w-full">
        <RefreshCwIcon className="size-4" aria-hidden="true" />
        Refresh navigator
      </Button>
    </aside>
  );
}
