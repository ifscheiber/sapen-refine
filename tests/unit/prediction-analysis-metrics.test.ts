import { describe, expect, it } from "vitest";

import {
  computeBinaryMaskMetrics,
  computeSemanticMaskMetrics,
  notComputedQaMetrics,
  supportValueFromLabels,
  type MetricLabelDefinition,
} from "@/server/domain/predictionAnalysisMetrics";

const labels: MetricLabelDefinition[] = [
  {
    stableId: "background",
    byteValue: 0,
    displayName: "Background",
    semanticMeaning: "Background",
    applicability: "SEMANTIC_MASK",
    sortOrder: 0,
    isTrainable: false,
  },
  {
    stableId: "sapwood",
    byteValue: 1,
    displayName: "Sapwood",
    semanticMeaning: "Sapwood material",
    applicability: "SEMANTIC_MASK",
    sortOrder: 10,
    isTrainable: true,
  },
  {
    stableId: "heartwood",
    byteValue: 2,
    displayName: "Heartwood",
    semanticMeaning: "Heartwood material",
    applicability: "SEMANTIC_MASK",
    sortOrder: 20,
    isTrainable: true,
  },
  {
    stableId: "copper",
    byteValue: 3,
    displayName: "Copper",
    semanticMeaning: "Copper material",
    applicability: "SEMANTIC_MASK",
    sortOrder: 30,
    isTrainable: true,
  },
  {
    stableId: "slice_support",
    byteValue: 10,
    displayName: "Slice support",
    semanticMeaning: "Physical slice support",
    applicability: "SUPPORT_MASK",
    sortOrder: 100,
    isTrainable: true,
  },
];

describe("prediction analysis metrics", () => {
  it("computes binary support IoU and Dice from pixel counts", () => {
    const result = computeBinaryMaskMetrics({
      prediction: new Uint8Array([0, 10, 10, 0]),
      reference: new Uint8Array([0, 10, 0, 10]),
      supportValue: 10,
    });

    expect(result).toMatchObject({
      truePositivePixels: 1,
      trueNegativePixels: 1,
      falsePositivePixels: 1,
      falseNegativePixels: 1,
      intersection: 1,
      union: 3,
      predictionSupportPixels: 2,
      referenceSupportPixels: 2,
    });
    expect(result.iou).toBeCloseTo(1 / 3);
    expect(result.dice).toBeCloseTo(0.5);
  });

  it("keeps empty binary unions as not-applicable metrics", () => {
    const result = computeBinaryMaskMetrics({
      prediction: new Uint8Array([0, 0, 0, 0]),
      reference: new Uint8Array([0, 0, 0, 0]),
      supportValue: 10,
    });

    expect(result.union).toBe(0);
    expect(result.iou).toBeNull();
    expect(result.dice).toBeNull();
  });

  it("computes semantic per-label metrics and confusion counts", () => {
    const result = computeSemanticMaskMetrics({
      prediction: new Uint8Array([0, 1, 2, 3]),
      reference: new Uint8Array([0, 1, 1, 2]),
      labels,
    });

    expect(result.pixelAccuracy).toBeCloseTo(0.5);
    expect(result.macroIoU).toBeCloseTo(1 / 6);
    expect(result.macroDice).toBeCloseTo(2 / 9);
    expect(result.perLabel).toEqual([
      expect.objectContaining({
        stableId: "sapwood",
        predictionPixels: 1,
        referencePixels: 2,
        intersection: 1,
        union: 2,
        iou: 0.5,
      }),
      expect.objectContaining({
        stableId: "heartwood",
        predictionPixels: 1,
        referencePixels: 1,
        intersection: 0,
        union: 2,
        iou: 0,
      }),
      expect.objectContaining({
        stableId: "copper",
        predictionPixels: 1,
        referencePixels: 0,
        intersection: 0,
        union: 1,
        iou: 0,
      }),
    ]);
    expect(result.confusionMatrix.counts[0][0]).toBe(1);
    expect(result.confusionMatrix.counts[1][1]).toBe(1);
    expect(result.confusionMatrix.counts[1][2]).toBe(1);
    expect(result.confusionMatrix.counts[2][3]).toBe(1);
  });

  it("tracks unknown semantic byte values without treating them as labels", () => {
    const result = computeSemanticMaskMetrics({
      prediction: new Uint8Array([0, 99]),
      reference: new Uint8Array([0, 88]),
      labels,
    });

    expect(result.confusionMatrix.unknownPredictionValues).toEqual([99]);
    expect(result.confusionMatrix.unknownReferenceValues).toEqual([88]);
  });

  it("resolves support label values from schema definitions only", () => {
    expect(supportValueFromLabels(labels)).toBe(10);
    expect(supportValueFromLabels(labels.filter((label) => label.stableId !== "slice_support"))).toBeNull();
  });

  it("creates stable not-computed metric payloads", () => {
    expect(notComputedQaMetrics({
      targetType: "SLICE_CLASSIFICATION",
      reason: "CLASSIFICATION_PREDICTION_NOT_IMPLEMENTED",
    })).toMatchObject({
      computed: false,
      metricVersion: "sapen-annotate-prediction-qa-metrics-v1",
      comparison: "prediction_vs_approved_human_reference",
      targetType: "SLICE_CLASSIFICATION",
      reason: "CLASSIFICATION_PREDICTION_NOT_IMPLEMENTED",
    });
  });

  it("rejects dimension mismatches", () => {
    expect(() =>
      computeBinaryMaskMetrics({
        prediction: new Uint8Array([0, 10]),
        reference: new Uint8Array([0]),
        supportValue: 10,
      })
    ).toThrow("DIMENSIONS_MISMATCH");
    expect(() =>
      computeSemanticMaskMetrics({
        prediction: new Uint8Array([0, 1]),
        reference: new Uint8Array([0]),
        labels,
      })
    ).toThrow("DIMENSIONS_MISMATCH");
  });
});

