import { AppMain } from "@/components/shell/AppMain";
import { AppMissingResource } from "@/components/shell/AppMissingResource";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import {
  WorkspaceContextRow,
  WorkspaceLocalTabs,
  WorkspaceMetaLabel,
  WorkspaceMetaRow,
  WorkspacePageHeader,
  WorkspacePageLayout,
} from "@/components/workspace/WorkspaceLayout";
import { canAnnotate, PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import { loadCropSliceNavigatorForUser } from "@/server/domain/cropSliceNavigator";
import { CropEditorSliceNavigatorRailClient } from "./CropEditorSliceNavigatorRailClient";
import { CropSemanticEditorClient } from "./CropSemanticEditorClient";
import type { CropSemanticMode } from "./editorTypes";

function initialEditorModeLabel(mode: CropSemanticMode | undefined, target: "semantic" | "support" | undefined) {
  if (target === "support") return "Support mask";
  if (mode === "COPPER") return "Copper semantic";
  return "Sap/Heartwood semantic";
}

function exportSummaryLabel(readyCount: number, totalSlices: number) {
  if (totalSlices === 0) return "No slices";
  if (readyCount === totalSlices) return "Ready";
  if (readyCount > 0) return `${readyCount}/${totalSlices} ready`;
  return "Not ready";
}

export async function CropSemanticEditorPage({
  projectId,
  imageId,
  sliceInstanceId,
  cropId,
  initialSemanticMode,
  initialTarget,
}: {
  projectId: string;
  imageId: string;
  sliceInstanceId: string;
  cropId: string;
  initialSemanticMode?: CropSemanticMode;
  initialTarget?: "semantic" | "support";
}) {
  const { user, membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

  const crop = await prisma.derivedSliceCrop.findFirst({
    where: {
      id: cropId,
      projectId,
      sourceImageId: imageId,
      sliceInstanceId,
    },
    select: {
      id: true,
      version: true,
      cropWidth: true,
      cropHeight: true,
      sourceX: true,
      sourceY: true,
      sourceWidth: true,
      sourceHeight: true,
      sourceImage: { select: { filename: true, contentType: true } },
    },
  });

  if (!crop) {
    return (
      <AppMain>
        <AppPageHeader title="Crop not found" description="SaPen Annotate" />
        <AppMissingResource
          title="Crop not found or no longer available"
          description="The crop may have been removed, the database may have been rebuilt, or the copied link may be stale."
          actions={[{ kind: "project", href: `/app/projects/${projectId}` }]}
        />
      </AppMain>
    );
  }

  const navigator = await loadCropSliceNavigatorForUser({
    projectId,
    imageId,
    userId: user.id,
    selectedSliceInstanceId: sliceInstanceId,
  });
  const filename = crop.sourceImage.filename ?? crop.id;
  const totalSlices = navigator.summary.totalSlices;
  const selectedSlice =
    navigator.slices.find((slice) => slice.sliceInstanceId === navigator.selectedSliceInstanceId) ??
    navigator.slices[0] ??
    null;
  const selectedSliceLabel = selectedSlice ? `${selectedSlice.index}/${Math.max(totalSlices, 1)}` : "None";
  const modeLabel = initialEditorModeLabel(initialSemanticMode, initialTarget);
  const exportLabel = exportSummaryLabel(navigator.summary.readyCount, totalSlices);
  const baseEditorHref =
    `/app/projects/${projectId}/images/${imageId}/crop/slices/${sliceInstanceId}/crops/${cropId}`;

  return (
    <WorkspacePageLayout
      header={
        <WorkspacePageHeader
          title="Annotation Editor"
          metadata={
            <WorkspaceMetaRow>
              <WorkspaceMetaLabel>Image</WorkspaceMetaLabel>
              <span className="truncate text-[var(--text-primary)]">{filename}</span>
              <span className="text-[var(--text-muted)]">·</span>
              <WorkspaceMetaLabel>Mode</WorkspaceMetaLabel>
              <span className="text-[var(--text-primary)]">{modeLabel}</span>
              <span className="text-[var(--text-muted)]">·</span>
              <WorkspaceMetaLabel>Slices</WorkspaceMetaLabel>
              <span className="tabular-nums text-[var(--text-primary)]">{totalSlices}</span>
              <span className="text-[var(--text-muted)]">·</span>
              <WorkspaceMetaLabel>Export</WorkspaceMetaLabel>
              <span className="text-[var(--text-primary)]">{exportLabel}</span>
            </WorkspaceMetaRow>
          }
        />
      }
      contextRow={
        <WorkspaceContextRow>
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-dim)]">
                Active image
              </span>
              <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                {filename}
              </span>
            </div>
            <div className="hidden h-4 w-px bg-[var(--border-subtle)] sm:block" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Crop
              </span>
              <span className="text-[12px] font-medium text-[var(--text-secondary)]">v{crop.version}</span>
            </div>
            <div className="hidden h-4 w-px bg-[var(--border-subtle)] sm:block" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Slice
              </span>
              <span className="tabular-nums text-[12px] font-medium text-[var(--text-secondary)]">
                {selectedSliceLabel}
              </span>
            </div>
            <div className="hidden h-4 w-px bg-[var(--border-subtle)] sm:block" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Export
              </span>
              <span className="text-[12px] font-medium text-[var(--text-secondary)]">{exportLabel}</span>
            </div>
          </div>
        </WorkspaceContextRow>
      }
      localTabs={
        <WorkspaceLocalTabs
          tabs={[
            { label: "BBoxes", href: navigator.routes.bboxesHref },
            {
              label: "Semantic Masks",
              href: `${baseEditorHref}?mode=${initialSemanticMode ?? "SAP_HEARTWOOD"}&target=semantic`,
              active: initialTarget !== "support",
            },
            {
              label: "Support Mask",
              href: `${baseEditorHref}?mode=COPPER&target=support`,
              active: initialTarget === "support",
            },
            { label: "Classification", href: `${baseEditorHref}#classification` },
            { label: "Export Readiness", href: `${baseEditorHref}#export-readiness` },
          ]}
        />
      }
      main={
        <CropSemanticEditorClient
          cropId={cropId}
          canEdit={canAnnotate(membership.role)}
          initialSemanticMode={initialSemanticMode}
          initialTarget={initialTarget}
        />
      }
      rail={<CropEditorSliceNavigatorRailClient navigator={navigator} editorMode="editor" />}
    />
  );
}
