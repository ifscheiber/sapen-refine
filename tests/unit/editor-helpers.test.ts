import { describe, expect, it } from "vitest";
import type React from "react";

import {
  API_ARTIFACT_REVIEW,
  API_CORRECTION_CONTEXT,
  API_IMAGE_VIEW,
  API_MASK_LATEST,
  API_SUPPORT_MASK_UPLOAD,
} from "@/features/editor/editorApi";
import {
  formatCorrectionModel,
  formatCorrectionScore,
  formatReviewState,
  formatSliceClassLabel,
  formatVersion,
  isAbortError,
} from "@/features/editor/editorFormatters";
import { shouldIgnorePointerDown } from "@/features/editor/editorPointer";
import type { CorrectionContext, ReviewVersion } from "@/features/editor/editorTypes";

describe("editor helpers", () => {
  it("builds stable editor API paths", () => {
    expect(API_IMAGE_VIEW("img_1")).toBe("/api/images/img_1/view");
    expect(API_MASK_LATEST("img_1")).toBe("/api/images/img_1/mask/latest");
    expect(API_SUPPORT_MASK_UPLOAD("img_1")).toBe("/api/images/img_1/support-mask/upload");
    expect(API_ARTIFACT_REVIEW("version_1")).toBe("/api/artifact-versions/version_1/review");
    expect(API_CORRECTION_CONTEXT("task_1")).toBe("/api/correction-tasks/task_1/correction-context");
  });

  it("formats review and classification labels", () => {
    const version: ReviewVersion = {
      id: "version_1",
      version: 3,
      reviewState: "SUBMITTED",
      createdAt: "2026-05-21T00:00:00.000Z",
      createdBy: { email: "labeler@example.test", name: null },
    };

    expect(formatReviewState("REVIEW_REQUIRED")).toBe("Review required");
    expect(formatReviewState(null)).toBe("Missing");
    expect(formatVersion(version)).toBe("Submitted v3");
    expect(formatVersion(null)).toBe("Missing");
    expect(formatSliceClassLabel("COPPER_SLICE")).toBe("Copper slice");
    expect(formatSliceClassLabel(null)).toBe("Missing");
  });

  it("formats assisted correction model and score context", () => {
    const context: CorrectionContext = {
      task: {
        id: "task_1",
        projectId: "project_1",
        imageId: "image_1",
        status: "OPEN",
        priority: 50,
        taskReason: "LOW_CONFIDENCE",
        confidenceScore: 0.42,
        uncertaintyScore: 0.58,
      },
      mode: "semantic",
      targetType: "SEMANTIC_MASK",
      humanArtifactKind: "SEMANTIC_MASK",
      predictionRun: {
        id: "run_1",
        inferenceRunId: "inference_1",
        modelRun: {
          modelFamily: "sapen",
          modelName: "wood-segmentation",
          modelVersion: "0.1.0",
        },
      },
      sourcePrediction: {
        id: "prediction_1",
        checksum: "sha256:test",
        width: 2,
        height: 2,
        format: "u8raw-v1",
      },
      predictionMaskUrl: "/api/correction-tasks/task_1/prediction-mask",
      correctionSaveUrl: "/api/correction-tasks/task_1/corrections",
    };

    expect(formatCorrectionModel(context)).toBe("sapen / wood-segmentation / 0.1.0");
    expect(formatCorrectionScore(context)).toBe("LOW_CONFIDENCE · confidence 0.42 · uncertainty 0.58");
    expect(formatCorrectionModel(null)).toBe("Unknown model");
    expect(formatCorrectionScore(null)).toBe("");
  });

  it("keeps pointer ignore decisions stable", () => {
    expect(shouldIgnorePointerDown({ pointerType: "mouse", button: 1, isPrimary: true } as React.PointerEvent<HTMLCanvasElement>)).toBe(true);
    expect(shouldIgnorePointerDown({ pointerType: "mouse", button: 0, isPrimary: true } as React.PointerEvent<HTMLCanvasElement>)).toBe(false);
    expect(shouldIgnorePointerDown({ pointerType: "touch", button: 0, isPrimary: false } as React.PointerEvent<HTMLCanvasElement>)).toBe(true);
    expect(shouldIgnorePointerDown({ pointerType: "pen", button: 0, isPrimary: true } as React.PointerEvent<HTMLCanvasElement>)).toBe(false);
  });

  it("recognizes abort errors without relying on fetch implementations", () => {
    expect(isAbortError({ name: "AbortError" })).toBe(true);
    expect(isAbortError(new Error("regular failure"))).toBe(false);
  });
});
