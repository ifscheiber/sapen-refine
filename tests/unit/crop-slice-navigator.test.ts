import { describe, expect, it } from "vitest";

import {
  buildCropSliceNavigatorModel,
  type CropSliceNavigatorImage,
} from "@/server/domain/cropSliceNavigator";
import type { CropWorkflowCandidate } from "@/server/domain/cropReadiness";
import type { SerializedImageBBoxWorkflow } from "@/server/domain/imageCropWorkflow";

const image: Omit<CropSliceNavigatorImage, "assetUrl"> = {
  id: "image-1",
  projectId: "project-1",
  filename: "source.png",
  contentType: "image/png",
  size: 100,
  width: 100,
  height: 80,
};

const workflow: SerializedImageBBoxWorkflow = {
  bboxSetStatus: "BBOX_CONFIRMED",
  persistedStatus: "CONFIRMED",
  activeBBoxCount: 2,
  confirmedAt: new Date("2026-01-01T00:00:00.000Z"),
  confirmedBy: { id: "user-1", email: "owner@test.local", name: "Owner" },
  lastBBoxChangeAt: null,
  lastBBoxVersionId: null,
  canConfirm: true,
  canEdit: true,
};

function cropCandidate(params: {
  id: string;
  sliceInstanceId: string;
  bboxVersionId: string;
  version: number;
  readinessStatus?: "READY" | "PARTIAL" | "NOT_READY" | "REVIEW_REQUIRED";
  supportStatus?: string;
  semanticStatus?: string;
  classificationStatus?: string;
}): CropWorkflowCandidate {
  return {
    crop: {
      id: params.id,
      version: params.version,
      sliceInstanceId: params.sliceInstanceId,
      bboxVersionId: params.bboxVersionId,
      cropWidth: 24,
      cropHeight: 18,
      paddingRequestedPx: 32,
      paddingClipped: false,
      createdAt: new Date(`2026-01-01T00:00:0${params.version}.000Z`),
    },
    latestSupportMask: params.supportStatus
      ? { reviewState: params.supportStatus, version: 3 }
      : null,
    latestSemanticMask: params.semanticStatus
      ? { reviewState: params.semanticStatus, version: 2, cropSemanticMode: "SAP_HEARTWOOD" }
      : null,
    latestClassification: params.classificationStatus
      ? {
          reviewState: params.classificationStatus,
          version: 1,
          class: "SAP_HEARTWOOD_SLICE",
          source: "AUTO_FROM_SEMANTIC_MASK",
        }
      : null,
    readinessStatus: params.readinessStatus ?? "PARTIAL",
    readinessReasons: params.readinessStatus === "READY" ? [] : ["MISSING_SEMANTIC_MASK"],
    nextActions: ["OPEN_SEMANTIC_EDITOR"],
  } as unknown as CropWorkflowCandidate;
}

describe("crop slice navigator model", () => {
  it("orders slices by source-image geometry and marks missing crops", () => {
    const model = buildCropSliceNavigatorModel({
      projectId: "project-1",
      image,
      myRole: "OWNER",
      canGenerateCrop: true,
      bboxWorkflow: workflow,
      selectedSliceInstanceId: "slice-top",
      boxes: [
        { bboxVersionId: "bbox-bottom", sliceInstanceId: "slice-bottom", version: 1, x: 5, y: 40, width: 10, height: 8 },
        { bboxVersionId: "bbox-top", sliceInstanceId: "slice-top", version: 1, x: 20, y: 4, width: 12, height: 10 },
      ],
      cropReadinessCandidates: [],
    });

    expect(model.slices.map((slice) => slice.sliceInstanceId)).toEqual(["slice-top", "slice-bottom"]);
    expect(model.selectedSliceInstanceId).toBe("slice-top");
    expect(model.slices[0]).toMatchObject({
      label: "Slice 1",
      cropStatus: "MISSING",
      supportStatus: "MISSING",
      semanticStatus: "MISSING",
      classificationStatus: "MISSING",
      readinessStatus: "NOT_READY",
    });
    expect(model.summary).toMatchObject({
      totalSlices: 2,
      missingCropCount: 2,
      currentCropCount: 0,
      staleCropCount: 0,
    });
  });

  it("uses the latest current crop for status badges and editor links", () => {
    const model = buildCropSliceNavigatorModel({
      projectId: "project-1",
      image,
      myRole: "OWNER",
      canGenerateCrop: true,
      bboxWorkflow: workflow,
      selectedSliceInstanceId: "slice-1",
      boxes: [
        { bboxVersionId: "bbox-current", sliceInstanceId: "slice-1", version: 2, x: 10, y: 10, width: 20, height: 14 },
      ],
      cropReadinessCandidates: [
        cropCandidate({
          id: "crop-current",
          sliceInstanceId: "slice-1",
          bboxVersionId: "bbox-current",
          version: 2,
          readinessStatus: "READY",
          supportStatus: "APPROVED",
          semanticStatus: "SUBMITTED",
          classificationStatus: "DRAFT",
        }),
      ],
    });

    expect(model.slices[0]).toMatchObject({
      cropStatus: "CURRENT",
      supportStatus: "APPROVED",
      semanticStatus: "SUBMITTED",
      semanticMode: "SAP_HEARTWOOD",
      classificationStatus: "DRAFT",
      classificationClass: "SAP_HEARTWOOD_SLICE",
      readinessStatus: "READY",
    });
    expect(model.slices[0].currentCrop?.id).toBe("crop-current");
    expect(model.slices[0].selectedHref).toBe(
      "/app/projects/project-1/images/image-1/crop/slices/slice-1/crops/crop-current",
    );
    expect(model.slices[0].workbenchHref).toBe(
      "/app/projects/project-1/images/image-1/crop/slices/slice-1/crops/crop-current",
    );
    expect(model.slices[0].supportHref).toContain("/crop/slices/slice-1/crops/crop-current/support");
    expect(model.slices[0].semanticHref).toContain("/crop/slices/slice-1/crops/crop-current/semantic");
    expect(model.summary.readyCount).toBe(1);
  });

  it("marks crops from older BBox versions as stale until regenerated", () => {
    const model = buildCropSliceNavigatorModel({
      projectId: "project-1",
      image,
      myRole: "OWNER",
      canGenerateCrop: true,
      bboxWorkflow: workflow,
      selectedSliceInstanceId: "slice-1",
      boxes: [
        { bboxVersionId: "bbox-v2", sliceInstanceId: "slice-1", version: 2, x: 10, y: 10, width: 20, height: 14 },
      ],
      cropReadinessCandidates: [
        cropCandidate({
          id: "crop-stale",
          sliceInstanceId: "slice-1",
          bboxVersionId: "bbox-v1",
          version: 1,
          readinessStatus: "READY",
          supportStatus: "APPROVED",
          semanticStatus: "APPROVED",
          classificationStatus: "APPROVED",
        }),
      ],
    });

    expect(model.slices[0]).toMatchObject({
      cropStatus: "STALE",
      currentCrop: null,
      readinessStatus: "NOT_READY",
      readinessReasons: ["CROP_NOT_CURRENT"],
      workbenchHref: null,
      supportHref: null,
      semanticHref: null,
    });
    expect(model.slices[0].latestCrop?.id).toBe("crop-stale");
    expect(model.summary).toMatchObject({
      staleCropCount: 1,
      readyCount: 0,
    });
  });
});
