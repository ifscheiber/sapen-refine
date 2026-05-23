import { describe, expect, it } from "vitest";

import {
  buildCropWorkbenchModeGuidance,
  cropWorkbenchNextAction,
  defaultSemanticModeFromSlice,
} from "@/features/editor/cropWorkbenchGuidance";
import type { CropSliceNavigatorSlice } from "@/server/domain/cropSliceNavigator";

function slice(params: Partial<CropSliceNavigatorSlice> = {}): CropSliceNavigatorSlice {
  return {
    index: 1,
    label: "Slice 1",
    sliceInstanceId: "slice-1",
    bboxVersionId: "bbox-1",
    bboxVersion: 1,
    bboxStatus: "BBOX_CONFIRMED",
    sourceRect: { x: 0, y: 0, width: 20, height: 10 },
    sourceRectPercent: { left: 0, top: 0, width: 20, height: 10 },
    cropStatus: "CURRENT",
    currentCrop: null,
    latestCrop: null,
    supportStatus: "MISSING",
    supportVersion: null,
    semanticStatus: "MISSING",
    semanticVersion: null,
    semanticMode: null,
    semanticFamilyState: "NONE",
    semanticFamilyActiveMode: null,
    classificationStatus: "MISSING",
    classificationClass: null,
    classificationSource: null,
    classificationVersion: null,
    readinessStatus: "NOT_READY",
    readinessReasons: [],
    nextActions: [],
    selectedHref: "/selected",
    workbenchHref: "/workbench",
    supportHref: "/support",
    semanticHref: "/semantic",
    ...params,
  };
}

describe("crop workbench guidance", () => {
  it("presents Sap/Heartwood semantic annotation as support-optional", () => {
    expect(buildCropWorkbenchModeGuidance("SAP_HEARTWOOD")).toMatchObject({
      label: "Sap/Heartwood",
      actionLabel: "Start Sap/Heartwood semantic",
      supportRequiredForReadiness: false,
    });
  });

  it("presents Copper drafts as editable but support-required for readiness", () => {
    expect(buildCropWorkbenchModeGuidance("COPPER")).toMatchObject({
      label: "Copper",
      actionLabel: "Draw Copper draft",
      supportRequiredForReadiness: true,
    });
  });

  it("keeps existing Copper semantic family visible as the selected mode", () => {
    expect(defaultSemanticModeFromSlice(slice({ semanticMode: "COPPER" }))).toBe("COPPER");
    expect(defaultSemanticModeFromSlice(slice({ semanticMode: "SAP_HEARTWOOD" }))).toBe("SAP_HEARTWOOD");
    expect(defaultSemanticModeFromSlice(slice())).toBe("SAP_HEARTWOOD");
  });

  it("maps readiness reasons to concrete next actions", () => {
    expect(cropWorkbenchNextAction(slice({ readinessReasons: ["MISSING_SUPPORT_MASK"] }))).toBe(
      "Add required support mask",
    );
    expect(cropWorkbenchNextAction(slice({ readinessReasons: ["MISSING_SEMANTIC_MASK"] }))).toBe(
      "Start semantic annotation",
    );
    expect(cropWorkbenchNextAction(slice({ nextActions: ["REVIEW_CLASSIFICATION"] }))).toBe(
      "review classification",
    );
  });
});
