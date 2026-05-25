import {
  SLICE_CLASS_OPTIONS,
  type ClassificationReviewVersion,
  type CorrectionContext,
  type ReviewStateValue,
  type ReviewVersion,
  type SliceClassificationDerivationReasonValue,
  type SliceClassificationSourceValue,
  type SliceClassValue,
} from "./editorTypes";

export function errorMessage(error: unknown, fallback = "Save failed") {
  return error instanceof Error ? error.message : fallback;
}

export function formatBBoxErrorMessage(error: unknown, fallback = "BBox action failed") {
  const message = errorMessage(error, fallback);
  if (message === "BBOX_TOO_SMALL") return "BBox too small. Enlarge the selection before preparing slices.";
  if (message === "BBOX_OVERLAP") return "BBox overlap detected. Move or resize boxes before continuing.";
  if (message === "BBOX_DELETE_PROTECTED_DEPENDENCIES") {
    return "Cannot delete: semantic/support or classification data exists for this slice.";
  }
  if (message === "BBOX_GEOMETRY_PROTECTED_DEPENDENCIES") {
    return "Cannot edit geometry: semantic/support or classification data exists for this slice.";
  }
  if (message === "BBOX_SET_EMPTY") return "Draw at least one BBox before opening slice annotation.";
  return message;
}

export function isAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

export function formatReviewState(state: ReviewStateValue | string | null | undefined) {
  if (!state) return "Missing";
  const normalized = state.toLowerCase().replaceAll("_", " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatVersion(version: ReviewVersion | ClassificationReviewVersion | null) {
  return version ? `${formatReviewState(version.reviewState)} v${version.version}` : "Missing";
}

export function formatSliceClassLabel(value: SliceClassValue | null | undefined) {
  return SLICE_CLASS_OPTIONS.find((option) => option.value === value)?.label ?? "Missing";
}

export function formatSliceClassificationSource(
  value: SliceClassificationSourceValue | null | undefined,
) {
  if (value === "AUTO_FROM_SEMANTIC_MASK") return "Auto from semantic mask";
  if (value === "MANUAL") return "Manual";
  return "Unknown source";
}

export function formatSliceClassificationReason(
  value: SliceClassificationDerivationReasonValue | null | undefined,
) {
  if (value === "COPPER_PIXELS_PRESENT") return "Copper pixels present";
  if (value === "SAP_HEARTWOOD_PIXELS_PRESENT") return "Sapwood/heartwood pixels present";
  if (value === "NO_CLASSIFYING_PIXELS") return "No classifying pixels";
  if (value === "UNKNOWN_PIXELS_PRESENT") return "Unknown pixels present";
  if (value === "SEMANTIC_MODE_LABEL_CONFLICT") return "Semantic mode label conflict";
  return null;
}

export function formatCorrectionModel(context: CorrectionContext | null) {
  const model = context?.predictionRun?.modelRun;
  return model
    ? [model.modelFamily, model.modelName, model.modelVersion].filter(Boolean).join(" / ")
    : "Unknown model";
}

export function formatCorrectionScore(context: CorrectionContext | null) {
  if (!context) return "";
  return [
    context.task.taskReason,
    context.task.confidenceScore === null ? null : `confidence ${context.task.confidenceScore.toFixed(2)}`,
    context.task.uncertaintyScore === null ? null : `uncertainty ${context.task.uncertaintyScore.toFixed(2)}`,
  ].filter(Boolean).join(" · ");
}
