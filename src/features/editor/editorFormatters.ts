import {
  SLICE_CLASS_OPTIONS,
  type ClassificationReviewVersion,
  type CorrectionContext,
  type ReviewStateValue,
  type ReviewVersion,
  type SliceClassValue,
} from "./editorTypes";

export function errorMessage(error: unknown, fallback = "Save failed") {
  return error instanceof Error ? error.message : fallback;
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
