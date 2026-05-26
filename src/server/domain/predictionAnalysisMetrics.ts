export const PREDICTION_QA_METRICS_VERSION = "sapen-annotate-prediction-qa-metrics-v1";
export const PREDICTION_QA_COMPARISON = "prediction_vs_approved_human_reference";

export type PredictionQaNotComputedReason =
  | "NO_APPROVED_REFERENCE"
  | "NO_PREDICTION_ARTIFACT"
  | "DIMENSIONS_MISMATCH"
  | "LABEL_SCHEMA_MISMATCH"
  | "TARGET_TYPE_UNSUPPORTED"
  | "ARTIFACT_READ_FAILED"
  | "EMPTY_REFERENCE_AND_PREDICTION"
  | "CLASSIFICATION_PREDICTION_NOT_IMPLEMENTED";

export type MetricLabelApplicability =
  | "SEMANTIC_MASK"
  | "SUPPORT_MASK"
  | "SLICE_CLASSIFICATION"
  | "REVIEW_FLAG";

export type MetricLabelDefinition = {
  stableId: string;
  byteValue: number | null;
  displayName: string;
  semanticMeaning: string;
  applicability: MetricLabelApplicability;
  sortOrder: number;
  isTrainable: boolean;
};

export type PredictionQaNotComputed = {
  computed: false;
  metricVersion: typeof PREDICTION_QA_METRICS_VERSION;
  comparison: typeof PREDICTION_QA_COMPARISON;
  targetType: string;
  reason: PredictionQaNotComputedReason;
  warnings: string[];
};

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function sortedByteLabels(labels: MetricLabelDefinition[], applicability: MetricLabelApplicability) {
  return labels
    .filter((label) => label.applicability === applicability && label.byteValue !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.stableId.localeCompare(b.stableId));
}

function uniqueSorted(values: Set<number>) {
  return Array.from(values).sort((a, b) => a - b);
}

export function notComputedQaMetrics(params: {
  targetType: string;
  reason: PredictionQaNotComputedReason;
  warnings?: string[];
}): PredictionQaNotComputed {
  return {
    computed: false,
    metricVersion: PREDICTION_QA_METRICS_VERSION,
    comparison: PREDICTION_QA_COMPARISON,
    targetType: params.targetType,
    reason: params.reason,
    warnings: params.warnings ?? [],
  };
}

export function computeBinaryMaskMetrics(params: {
  prediction: Uint8Array;
  reference: Uint8Array;
  supportValue: number;
}) {
  if (params.prediction.byteLength !== params.reference.byteLength) {
    throw new Error("DIMENSIONS_MISMATCH");
  }

  let truePositivePixels = 0;
  let trueNegativePixels = 0;
  let falsePositivePixels = 0;
  let falseNegativePixels = 0;

  for (let index = 0; index < params.prediction.byteLength; index += 1) {
    const predictionSupport = params.prediction[index] === params.supportValue;
    const referenceSupport = params.reference[index] === params.supportValue;
    if (predictionSupport && referenceSupport) truePositivePixels += 1;
    else if (predictionSupport && !referenceSupport) falsePositivePixels += 1;
    else if (!predictionSupport && referenceSupport) falseNegativePixels += 1;
    else trueNegativePixels += 1;
  }

  const predictionSupportPixels = truePositivePixels + falsePositivePixels;
  const referenceSupportPixels = truePositivePixels + falseNegativePixels;
  const union = truePositivePixels + falsePositivePixels + falseNegativePixels;

  return {
    pixelCount: params.prediction.byteLength,
    supportValue: params.supportValue,
    truePositivePixels,
    trueNegativePixels,
    falsePositivePixels,
    falseNegativePixels,
    intersection: truePositivePixels,
    union,
    predictionSupportPixels,
    referenceSupportPixels,
    iou: ratio(truePositivePixels, union),
    dice: ratio(2 * truePositivePixels, predictionSupportPixels + referenceSupportPixels),
  };
}

export function computeSemanticMaskMetrics(params: {
  prediction: Uint8Array;
  reference: Uint8Array;
  labels: MetricLabelDefinition[];
}) {
  if (params.prediction.byteLength !== params.reference.byteLength) {
    throw new Error("DIMENSIONS_MISMATCH");
  }

  const labels = sortedByteLabels(params.labels, "SEMANTIC_MASK");
  const trainableLabels = labels.filter((label) => label.isTrainable);
  const indexByValue = new Map<number, number>();
  labels.forEach((label, index) => {
    if (label.byteValue !== null) indexByValue.set(label.byteValue, index);
  });

  const predictionCounts = new Map<number, number>();
  const referenceCounts = new Map<number, number>();
  const intersectionCounts = new Map<number, number>();
  const confusionCounts = labels.map(() => labels.map(() => 0));
  const unknownPredictionValues = new Set<number>();
  const unknownReferenceValues = new Set<number>();
  let equalPixels = 0;

  for (let index = 0; index < params.prediction.byteLength; index += 1) {
    const predictionValue = params.prediction[index] ?? 0;
    const referenceValue = params.reference[index] ?? 0;
    predictionCounts.set(predictionValue, (predictionCounts.get(predictionValue) ?? 0) + 1);
    referenceCounts.set(referenceValue, (referenceCounts.get(referenceValue) ?? 0) + 1);
    if (predictionValue === referenceValue) {
      equalPixels += 1;
      intersectionCounts.set(predictionValue, (intersectionCounts.get(predictionValue) ?? 0) + 1);
    }

    const referenceIndex = indexByValue.get(referenceValue);
    const predictionIndex = indexByValue.get(predictionValue);
    if (referenceIndex === undefined) unknownReferenceValues.add(referenceValue);
    if (predictionIndex === undefined) unknownPredictionValues.add(predictionValue);
    if (referenceIndex !== undefined && predictionIndex !== undefined) {
      confusionCounts[referenceIndex][predictionIndex] += 1;
    }
  }

  const perLabel = trainableLabels.map((label) => {
    const byteValue = label.byteValue ?? 0;
    const predictionPixels = predictionCounts.get(byteValue) ?? 0;
    const referencePixels = referenceCounts.get(byteValue) ?? 0;
    const intersection = intersectionCounts.get(byteValue) ?? 0;
    const union = predictionPixels + referencePixels - intersection;
    return {
      stableId: label.stableId,
      byteValue,
      displayName: label.displayName,
      semanticMeaning: label.semanticMeaning,
      predictionPixels,
      referencePixels,
      intersection,
      union,
      iou: ratio(intersection, union),
      dice: ratio(2 * intersection, predictionPixels + referencePixels),
    };
  });

  const computedIoUs = perLabel.map((label) => label.iou).filter((value): value is number => value !== null);
  const computedDice = perLabel.map((label) => label.dice).filter((value): value is number => value !== null);

  return {
    pixelCount: params.prediction.byteLength,
    pixelAccuracy: ratio(equalPixels, params.prediction.byteLength),
    macroIoU: computedIoUs.length > 0
      ? computedIoUs.reduce((sum, value) => sum + value, 0) / computedIoUs.length
      : null,
    macroDice: computedDice.length > 0
      ? computedDice.reduce((sum, value) => sum + value, 0) / computedDice.length
      : null,
    perLabel,
    trainablePredictionPixels: perLabel.reduce((sum, label) => sum + label.predictionPixels, 0),
    trainableReferencePixels: perLabel.reduce((sum, label) => sum + label.referencePixels, 0),
    confusionMatrix: {
      rows: "reference_labels",
      columns: "prediction_labels",
      labels: labels.map((label) => ({
        stableId: label.stableId,
        byteValue: label.byteValue,
        displayName: label.displayName,
      })),
      counts: confusionCounts,
      unknownPredictionValues: uniqueSorted(unknownPredictionValues),
      unknownReferenceValues: uniqueSorted(unknownReferenceValues),
    },
  };
}

export function supportValueFromLabels(labels: MetricLabelDefinition[]) {
  return labels.find((label) =>
    label.stableId === "slice_support" &&
    label.applicability === "SUPPORT_MASK" &&
    label.byteValue !== null
  )?.byteValue ?? null;
}

