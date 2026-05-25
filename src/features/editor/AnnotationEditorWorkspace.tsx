import {
  WorkspaceContextRow,
  WorkspaceLocalTabs,
  WorkspaceMetaLabel,
  WorkspaceMetaRow,
  WorkspacePageHeader,
  WorkspacePageLayout,
} from "@/components/workspace/WorkspaceLayout";
import type { CropSliceNavigatorModel } from "@/server/domain/cropSliceNavigator";

import { CropEditorSliceNavigatorRailClient } from "./CropEditorSliceNavigatorRailClient";
import type { CropSemanticMode } from "./editorTypes";

export type AnnotationEditorTab = "bboxes" | "semantic" | "export-readiness";

function exportSummaryLabel(readyCount: number, totalSlices: number) {
  if (totalSlices === 0) return "No slices";
  if (readyCount === totalSlices) return "Ready";
  if (readyCount > 0) return `${readyCount}/${totalSlices} ready`;
  return "Not ready";
}

function selectedSliceLabel(navigator: CropSliceNavigatorModel) {
  const selected =
    navigator.slices.find((slice) => slice.sliceInstanceId === navigator.selectedSliceInstanceId) ??
    navigator.slices[0] ??
    null;
  if (!selected) return "None";
  return `${selected.index}/${Math.max(navigator.summary.totalSlices, 1)}`;
}

function firstCurrentCropHref(navigator: CropSliceNavigatorModel) {
  const slice = navigator.slices.find((candidate) => candidate.currentCrop) ?? null;
  if (!slice?.currentCrop) return null;
  return (
    `/app/projects/${navigator.projectId}/images/${navigator.imageId}` +
    `/crop/slices/${slice.sliceInstanceId}/crops/${slice.currentCrop.id}`
  );
}

function tabBaseHref(navigator: CropSliceNavigatorModel, explicitBaseHref?: string | null) {
  return explicitBaseHref ?? firstCurrentCropHref(navigator);
}

function semanticTabHref(baseHref: string | null, fallbackHref: string, semanticMode: CropSemanticMode) {
  if (!baseHref) return fallbackHref;
  return `${baseHref}?mode=${semanticMode}&target=semantic`;
}

function anchorTabHref(baseHref: string | null, fallbackHref: string, anchor: string) {
  if (!baseHref) return fallbackHref;
  return `${baseHref}#${anchor}`;
}

export function AnnotationEditorWorkspace({
  navigator,
  activeTab,
  modeLabel,
  cropContextLabel,
  semanticMode = "SAP_HEARTWOOD",
  editorBaseHref,
  localTabsOverride,
  main,
  rail = true,
  railSuffix,
}: {
  navigator: CropSliceNavigatorModel;
  activeTab: AnnotationEditorTab;
  modeLabel: string;
  cropContextLabel: string;
  semanticMode?: CropSemanticMode;
  editorBaseHref?: string | null;
  localTabsOverride?: React.ReactNode;
  main: React.ReactNode;
  rail?: boolean;
  railSuffix?: React.ReactNode;
}) {
  const filename = navigator.image.filename ?? navigator.image.id;
  const totalSlices = navigator.summary.totalSlices;
  const exportLabel = exportSummaryLabel(navigator.summary.readyCount, totalSlices);
  const baseHref = tabBaseHref(navigator, editorBaseHref);
  const fallbackEditorHref = navigator.routes.slicesHref;

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
              <span className="text-[12px] font-medium text-[var(--text-secondary)]">{cropContextLabel}</span>
            </div>
            <div className="hidden h-4 w-px bg-[var(--border-subtle)] sm:block" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Slice
              </span>
              <span className="tabular-nums text-[12px] font-medium text-[var(--text-secondary)]">
                {selectedSliceLabel(navigator)}
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
        localTabsOverride ?? (
          <WorkspaceLocalTabs
            tabs={[
              {
                keyId: "bboxes",
                label: "BBoxes",
                href: navigator.routes.bboxesHref,
                active: activeTab === "bboxes",
              },
              {
                keyId: "semantic",
                label: "Semantic Masks",
                href: semanticTabHref(baseHref, fallbackEditorHref, semanticMode),
                active: activeTab === "semantic",
              },
              {
                keyId: "export-readiness",
                label: "Export Readiness",
                href: anchorTabHref(baseHref, fallbackEditorHref, "export-readiness"),
                active: activeTab === "export-readiness",
              },
            ]}
          />
        )
      }
      main={main}
      rail={rail ? (
        <>
          <CropEditorSliceNavigatorRailClient navigator={navigator} editorMode="editor" />
          {railSuffix}
        </>
      ) : null}
    />
  );
}
