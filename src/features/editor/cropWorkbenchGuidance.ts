import type { CropSliceNavigatorSlice } from "@/server/domain/cropSliceNavigator";
import { Labels, type LabelId } from "@/mask/labels";
import type { CropSemanticMode } from "./editorTypes";

export type CropWorkbenchModeGuidance = {
  mode: CropSemanticMode;
  label: string;
  actionLabel: string;
  supportPolicyLabel: string;
  readinessLabel: string;
  supportRequiredForReadiness: boolean;
};

export function cropSemanticModeLabel(mode: CropSemanticMode) {
  return mode === "COPPER" ? "Copper" : "Sap/Heartwood";
}

export function defaultSemanticModeFromSlice(slice: Pick<CropSliceNavigatorSlice, "semanticMode"> | null) {
  return slice?.semanticMode === "COPPER" ? "COPPER" : "SAP_HEARTWOOD";
}

export function defaultLabelForSemanticMode(mode: CropSemanticMode): LabelId {
  return mode === "COPPER" ? Labels.COPPER : Labels.SAPWOOD;
}

export function buildCropWorkbenchModeGuidance(mode: CropSemanticMode): CropWorkbenchModeGuidance {
  if (mode === "COPPER") {
    return {
      mode,
      label: "Copper",
      actionLabel: "Draw Copper draft",
      supportPolicyLabel: "Support mask required for export",
      readinessLabel: "Copper semantic drafts can be saved without support, but approved explicit support is required before export readiness.",
      supportRequiredForReadiness: true,
    };
  }

  return {
    mode,
    label: "Sap/Heartwood",
    actionLabel: "Start Sap/Heartwood semantic",
    supportPolicyLabel: "Support mask optional",
    readinessLabel: "Sap/Heartwood semantic foreground can define support geometry for readiness and export.",
    supportRequiredForReadiness: false,
  };
}

export function cropWorkbenchNextAction(slice: CropSliceNavigatorSlice) {
  if (slice.cropStatus === "MISSING") return "Generate crop";
  if (slice.cropStatus === "STALE") return "Regenerate crop";
  if (slice.readinessReasons.includes("MISSING_SEMANTIC_MASK")) return "Start semantic annotation";
  if (slice.readinessReasons.includes("MISSING_SUPPORT_MASK")) return "Add required support mask";
  if (slice.readinessReasons.includes("AUTO_CLASSIFICATION_NEEDS_REVIEW")) return "Review auto-derived classification";
  if (slice.nextActions[0]) return slice.nextActions[0].toLowerCase().replaceAll("_", " ");
  return "Review readiness";
}
