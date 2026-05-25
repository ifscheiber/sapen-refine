"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/components/ui/utils";
import { dispatchBBoxStageStatus } from "./bboxStageEvents";
import {
  API_CONFIRM_SLICE_BBOX_SET,
  API_ENSURE_SLICE_CROPS,
} from "./editorApi";
import { formatBBoxErrorMessage } from "./editorFormatters";

type BBoxStageTabTarget = "semantic" | "export-readiness";

type EnsuredCrop = {
  id: string;
  sliceInstanceId: string;
};

const tabClass =
  "relative rounded-none pb-3 pl-4 pr-4 text-sm font-semibold transition-colors first:pl-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
const activeTabClass =
  "text-[var(--text-primary)] after:absolute after:bottom-[-1px] after:h-0.5 after:bg-[var(--accent-primary)] after:left-0 after:right-4";
const idleTabClass = "text-[var(--text-secondary)] hover:text-[var(--text-primary)]";

function targetHref(params: {
  projectId: string;
  imageId: string;
  crop: EnsuredCrop | null;
  target: BBoxStageTabTarget;
}) {
  const base = params.crop
    ? `/app/projects/${params.projectId}/images/${params.imageId}/crop/slices/${params.crop.sliceInstanceId}/crops/${params.crop.id}`
    : `/app/projects/${params.projectId}/images/${params.imageId}/crop/slices`;
  return params.target === "semantic" ? `${base}?mode=SAP_HEARTWOOD&target=semantic` : `${base}#export-readiness`;
}

export function BBoxStageTabsClient({
  projectId,
  imageId,
  bboxesHref,
}: {
  projectId: string;
  imageId: string;
  bboxesHref: string;
}) {
  const router = useRouter();
  const [busyTarget, setBusyTarget] = useState<BBoxStageTabTarget | null>(null);
  const [status, setStatus] = useState("");

  async function prepareAndNavigate(target: BBoxStageTabTarget) {
    if (busyTarget) return;
    setBusyTarget(target);
    setStatus("");
    dispatchBBoxStageStatus({ saveState: "saving", lastAction: "Preparing slices", refresh: true });

    try {
      const confirmResponse = await fetch(API_CONFIRM_SLICE_BBOX_SET(imageId), { method: "POST" });
      const confirmBody = await confirmResponse.json().catch(() => null);
      if (!confirmResponse.ok || !confirmBody?.ok) {
        throw new Error(confirmBody?.error ?? `BBOX_CONFIRM_FAILED_${confirmResponse.status}`);
      }

      const ensureResponse = await fetch(API_ENSURE_SLICE_CROPS(imageId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const ensureBody = await ensureResponse.json().catch(() => null);
      if (!ensureResponse.ok || !ensureBody?.ok) {
        throw new Error(ensureBody?.error ?? `SLICE_CROP_ENSURE_FAILED_${ensureResponse.status}`);
      }

      const crops = (ensureBody.crops ?? []) as EnsuredCrop[];
      const crop = crops[0] ?? null;
      dispatchBBoxStageStatus({ saveState: "saved", lastAction: "Slices prepared", refresh: true });
      router.push(targetHref({ projectId, imageId, crop, target }));
      router.refresh();
    } catch (error) {
      const message = formatBBoxErrorMessage(error, "Slice preparation failed");
      setStatus(message);
      dispatchBBoxStageStatus({ saveState: "failed", lastAction: message, refresh: true });
    } finally {
      setBusyTarget(null);
    }
  }

  return (
    <nav aria-label="Project workspace tabs" className="border-b border-[var(--border-subtle)] pl-4">
      <div className="flex flex-wrap items-center gap-7">
        <Link href={bboxesHref} aria-current="page" className={cn(tabClass, activeTabClass)}>
          BBoxes
        </Link>
        <a
          href={targetHref({ projectId, imageId, crop: null, target: "semantic" })}
          aria-disabled={busyTarget !== null}
          className={cn(tabClass, idleTabClass, busyTarget && "pointer-events-none opacity-60")}
          onClick={(event) => {
            event.preventDefault();
            void prepareAndNavigate("semantic");
          }}
        >
          Semantic Masks
        </a>
        <a
          href={targetHref({ projectId, imageId, crop: null, target: "export-readiness" })}
          aria-disabled={busyTarget !== null}
          className={cn(tabClass, idleTabClass, busyTarget && "pointer-events-none opacity-60")}
          onClick={(event) => {
            event.preventDefault();
            void prepareAndNavigate("export-readiness");
          }}
        >
          Export Readiness
        </a>
      </div>
      {status ? (
        <div role="status" className="pb-2 pr-4 text-[11px] font-medium text-[var(--warning-text)]">
          {status}
        </div>
      ) : null}
    </nav>
  );
}
