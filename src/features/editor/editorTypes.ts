import type { LabelId } from "@/mask/labels";
import type { Patch } from "@/mask/patch";

export type EditorProps = {
  projectId: string;
  imageId: string;
  canEdit: boolean;
  correctionTaskId?: string;
  correctionMode?: MaskMode;
};

export type Stroke = Patch[];
export type Tool = "brush" | "lasso_free" | "lasso_poly";
export type MaskMode = "semantic" | "support";
export type Point = { x: number; y: number };

export type SliceClassValue =
  | "SAP_HEARTWOOD_SLICE"
  | "COPPER_SLICE"
  | "UNKNOWN"
  | "REVIEW_REQUIRED";
export type ReviewStateValue = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SUPERSEDED";
export type ReviewAction = "submit" | "approve" | "reject";

export type SliceState = {
  canEdit: boolean;
  supportLabels: { background: number; sliceSupport: number };
  sliceInstance: { id: string; supportArtifactVersionId: string | null } | null;
  latestSupportMask: {
    id: string;
    version: number;
    reviewState: string;
    createdAt: string;
    createdBy: { email: string; name: string | null } | null;
  } | null;
  latestClassification: {
    id: string;
    version: number;
    class: SliceClassValue;
    reviewState: string;
    createdAt: string;
    createdBy: { email: string; name: string | null } | null;
  } | null;
};

export type ReviewVersion = {
  id: string;
  version: number;
  reviewState: ReviewStateValue;
  createdAt: string;
  createdBy: { email: string; name: string | null } | null;
};

export type ClassificationReviewVersion = ReviewVersion & {
  class: SliceClassValue;
};

export type ReviewableState = {
  type: "SEMANTIC_MASK" | "SLICE_SUPPORT_MASK" | "SLICE_CLASSIFICATION";
  label: string;
  latestVersion: ReviewVersion | ClassificationReviewVersion | null;
  latestApprovedVersion: ReviewVersion | ClassificationReviewVersion | null;
  exportReady: boolean;
  actions: {
    canSubmit: boolean;
    canApprove: boolean;
    canReject: boolean;
  };
};

export type ImageReviewState = {
  myRole: string;
  permissions: { canSubmit: boolean; canReview: boolean };
  reviewables: {
    semanticMask: ReviewableState;
    supportMask: ReviewableState;
    sliceClassification: ReviewableState;
  };
  exportReady: boolean;
  warnings: string[];
};

export type CorrectionContext = {
  task: {
    id: string;
    projectId: string;
    imageId: string;
    status: string;
    priority: number;
    taskReason: string | null;
    confidenceScore: number | null;
    uncertaintyScore: number | null;
  };
  mode: MaskMode;
  targetType: "SEMANTIC_MASK" | "SLICE_SUPPORT_MASK";
  humanArtifactKind: "SEMANTIC_MASK" | "SLICE_SUPPORT_MASK";
  predictionRun: {
    id: string;
    inferenceRunId: string | null;
    modelRun: {
      modelFamily: string;
      modelName: string;
      modelVersion: string | null;
    };
  } | null;
  sourcePrediction: {
    id: string;
    checksum: string | null;
    width: number;
    height: number;
    format: string;
  };
  predictionMaskUrl: string;
  correctionSaveUrl: string;
};

export type EditorLabelOption = {
  id: LabelId;
  key: string;
  name: string;
  rgb: [number, number, number];
  alpha?: number;
};

export const SLICE_CLASS_OPTIONS: Array<{ value: SliceClassValue; label: string }> = [
  { value: "SAP_HEARTWOOD_SLICE", label: "Sap/Heartwood slice" },
  { value: "COPPER_SLICE", label: "Copper slice" },
  { value: "UNKNOWN", label: "Unknown" },
  { value: "REVIEW_REQUIRED", label: "Review required" },
];
