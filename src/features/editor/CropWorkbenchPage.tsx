import Link from "next/link";
import {
  AlertTriangleIcon,
  LayersIcon,
  ShieldIcon,
  SquareMousePointerIcon,
} from "lucide-react";
import { redirect } from "next/navigation";

import { AppEmptyState } from "@/components/shell/AppEmptyState";
import { AppMain } from "@/components/shell/AppMain";
import { AppMissingResource } from "@/components/shell/AppMissingResource";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import {
  CropSliceNavigatorWorkflowError,
  loadCropSliceNavigatorForUser,
  type CropSliceNavigatorSlice,
} from "@/server/domain/cropSliceNavigator";
import {
  buildCropWorkbenchModeGuidance,
  cropWorkbenchNextAction,
} from "./cropWorkbenchGuidance";
import { CropEditorSliceNavigatorRailClient } from "./CropEditorSliceNavigatorRailClient";
import type { CropSemanticMode } from "./editorTypes";

function formatToken(value: string | null) {
  if (!value) return "Missing";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatClassName(value: string | null) {
  if (value === "SAP_HEARTWOOD_SLICE") return "Sap/Heartwood";
  if (value === "COPPER_SLICE") return "Copper";
  return formatToken(value);
}

function formatSemanticFamily(value: string | null) {
  if (value === "SAP_HEARTWOOD") return "Sap/Heartwood";
  if (value === "COPPER") return "Copper";
  if (value === "CONFLICT") return "Conflict";
  return "None";
}

function badgeKind(status: string) {
  if (status === "APPROVED" || status === "READY" || status === "CURRENT" || status === "BBOX_CONFIRMED") {
    return "good";
  }
  if (status === "REJECTED" || status === "REVIEW_REQUIRED" || status === "STALE" || status === "BBOX_NEEDS_UPDATE") {
    return "bad";
  }
  if (status === "SUBMITTED" || status === "PARTIAL") return "warn";
  return "neutral";
}

function badgeClass(kind: "neutral" | "good" | "warn" | "bad") {
  return cn(
    "inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-xs font-medium",
    kind === "good" && "border-border bg-accent text-accent-foreground",
    kind === "warn" && "border-border bg-muted text-foreground",
    kind === "bad" && "border-destructive/40 bg-destructive/10 text-destructive",
    kind === "neutral" && "border-border bg-background text-muted-foreground",
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <span className={badgeClass(badgeKind(value))}>
      {label}: {formatToken(value)}
    </span>
  );
}

function semanticModeHref(href: string | null, mode: CropSemanticMode) {
  return href ? `${href}?mode=${mode}` : null;
}

function ModeCard({
  slice,
  mode,
}: {
  slice: CropSliceNavigatorSlice;
  mode: CropSemanticMode;
}) {
  const guidance = buildCropWorkbenchModeGuidance(mode);
  const href = semanticModeHref(slice.semanticHref, mode);
  const active = slice.semanticMode === mode;

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{guidance.label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{guidance.supportPolicyLabel}</p>
        </div>
        <span className={badgeClass(active ? "good" : "neutral")}>{active ? "Current family" : "Available"}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{guidance.readinessLabel}</p>
      <div className="mt-4">
        {href ? (
          <Button asChild variant={active ? "default" : "outline"}>
            <Link href={href}>
              <LayersIcon className="size-4" aria-hidden="true" />
              {guidance.actionLabel}
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled>
            <LayersIcon className="size-4" aria-hidden="true" />
            {guidance.actionLabel}
          </Button>
        )}
      </div>
    </section>
  );
}

function SelectedCropPanel({ slice }: { slice: CropSliceNavigatorSlice }) {
  const crop = slice.currentCrop;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4 text-card-foreground">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{slice.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Source x {slice.sourceRect.x}, y {slice.sourceRect.y}, {slice.sourceRect.width} x{" "}
              {slice.sourceRect.height}; BBox v{slice.bboxVersion}.
            </p>
          </div>
          <span className={badgeClass(badgeKind(slice.readinessStatus))}>{formatToken(slice.readinessStatus)}</span>
        </div>

        {crop && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-md border border-border bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={crop.assetUrl}
                alt={`Crop preview for ${slice.label}`}
                className="block h-auto w-full object-contain"
              />
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                <StatusPill label="BBox" value={slice.bboxStatus} />
                <StatusPill label="Crop" value={slice.cropStatus} />
                <StatusPill label="Support" value={slice.supportStatus} />
                <StatusPill label="Semantic" value={slice.semanticStatus} />
                <StatusPill label="Class" value={slice.classificationStatus} />
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Crop</dt>
                  <dd className="font-medium">
                    v{crop.version}, {crop.cropWidth} x {crop.cropHeight}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Semantic family</dt>
                  <dd className="font-medium">{formatSemanticFamily(slice.semanticFamilyState)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Classification</dt>
                  <dd className="font-medium">
                    {formatClassName(slice.classificationClass)}
                    {slice.classificationSource ? ` / ${formatToken(slice.classificationSource)}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Next action</dt>
                  <dd className="font-medium">{cropWorkbenchNextAction(slice)}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {slice.readinessReasons.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
            <AlertTriangleIcon className="mt-0.5 size-4" aria-hidden="true" />
            <span>
              {slice.readinessReasons.slice(0, 4).map(formatToken).join(", ")}
              {slice.readinessReasons.length > 4 ? ", ..." : ""}
            </span>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ModeCard slice={slice} mode="SAP_HEARTWOOD" />
        <ModeCard slice={slice} mode="COPPER" />
      </div>

      <section className="rounded-lg border border-border bg-card p-4 text-card-foreground">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Support mask</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional for Sap/Heartwood. Required and review-approved before Copper crop export readiness.
            </p>
          </div>
          <span className={badgeClass(badgeKind(slice.supportStatus))}>{formatToken(slice.supportStatus)}</span>
        </div>
        <div className="mt-4">
          {slice.supportHref ? (
            <Button asChild variant="outline">
              <Link href={slice.supportHref}>
                <ShieldIcon className="size-4" aria-hidden="true" />
                Open support editor
              </Link>
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled>
              <ShieldIcon className="size-4" aria-hidden="true" />
              Open support editor
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

export async function CropWorkbenchPage({
  projectId,
  imageId,
  sliceInstanceId,
  cropId,
}: {
  projectId: string;
  imageId: string;
  sliceInstanceId: string;
  cropId: string;
}) {
  const { user, membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

  const crop = await prisma.derivedSliceCrop.findFirst({
    where: {
      id: cropId,
      projectId,
      sourceImageId: imageId,
      sliceInstanceId,
    },
    select: { id: true },
  });

  if (!crop) {
    return (
      <AppMain>
        <AppPageHeader title="Crop not found" description="SaPen Annotate" />
        <AppMissingResource
          title="Crop not found or no longer available"
          description="The crop may have been replaced, the database may have been rebuilt, or the copied link may be stale."
          actions={[{ kind: "project", href: `/app/projects/${projectId}` }]}
        />
      </AppMain>
    );
  }

  let navigator;
  try {
    navigator = await loadCropSliceNavigatorForUser({
      projectId,
      imageId,
      userId: user.id,
      selectedSliceInstanceId: sliceInstanceId,
    });
  } catch (error) {
    if (!(error instanceof CropSliceNavigatorWorkflowError) || error.code !== "IMAGE_NOT_FOUND") {
      throw error;
    }
    return (
      <AppMain>
        <AppPageHeader title="Image not found" description="SaPen Annotate" />
        <AppMissingResource
          title="Image not found or no longer available"
          description="The image may have been removed, the database may have been rebuilt, or the copied link may be stale."
          actions={[{ kind: "project", href: `/app/projects/${projectId}` }]}
        />
      </AppMain>
    );
  }

  if (navigator.bboxWorkflow.bboxSetStatus !== "BBOX_CONFIRMED") {
    redirect(navigator.routes.bboxesHref);
  }

  const selectedSlice = navigator.slices.find((slice) => slice.sliceInstanceId === sliceInstanceId) ?? null;
  if (!selectedSlice) {
    return (
      <AppMain>
        <AppPageHeader title="Slice not found" description="SaPen Annotate" />
        <AppMissingResource
          title="Slice not found or no longer available"
          description="The selected slice may have been replaced when the image-level BBox set changed."
          actions={[{ kind: "project", href: `/app/projects/${projectId}` }]}
        />
      </AppMain>
    );
  }

  if (selectedSlice.currentCrop?.id !== cropId) {
    return (
      <AppMain>
        <AppPageHeader
          title={`Crop workbench: ${selectedSlice.label}`}
          description={`Role: ${membership.role}`}
          actions={
            <Button asChild variant="outline">
              <Link href={navigator.routes.bboxesHref}>
                <SquareMousePointerIcon className="size-4" aria-hidden="true" />
                Edit BBoxes
              </Link>
            </Button>
          }
        />
        <AppEmptyState
          title="Crop is not current"
          description="The selected crop no longer matches the current confirmed BBox version for this slice."
          action={
            <Button asChild>
              <Link href={`${navigator.routes.slicesHref}/${sliceInstanceId}`}>Open current slice</Link>
            </Button>
          }
        />
      </AppMain>
    );
  }

  return (
    <AppMain className="max-w-none">
      <AppPageHeader
        title={`Crop workbench: ${selectedSlice.label}`}
        description={
          `${navigator.image.filename ?? navigator.image.id} · ` +
          `${selectedSlice.currentCrop.cropWidth} x ${selectedSlice.currentCrop.cropHeight} crop · ` +
          `Role: ${membership.role}`
        }
        actions={
          <Button asChild variant="outline">
            <Link href={navigator.routes.bboxesHref}>
              <SquareMousePointerIcon className="size-4" aria-hidden="true" />
              Edit BBoxes
            </Link>
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <SelectedCropPanel slice={selectedSlice} />
        <CropEditorSliceNavigatorRailClient navigator={navigator} editorMode="workbench" />
      </div>
    </AppMain>
  );
}
