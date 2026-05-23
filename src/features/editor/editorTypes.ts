import type { LabelId } from "@/mask/labels";
import type { Patch } from "@/mask/patch";

export type EditorProps = {
  projectId: string;
  imageId: string;
  canEdit: boolean;
  correctionTaskId?: string;
  correctionMode?: MaskMode;
  workflowMode?: "fullEditor" | "bboxStage";
};

export type Stroke = Patch[];
export type Tool = "brush" | "eraser" | "lasso_free" | "lasso_poly" | "bbox";
export type MaskMode = "semantic" | "support";
export type Point = { x: number; y: number };

export type SliceBoundingBoxProposal = {
  bboxVersionId: string;
  sliceInstanceId: string;
  version: number;
  status: "ACTIVE" | "DELETED";
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSpace: "SOURCE_IMAGE_PIXEL";
  provenance: string;
  createdAt: string;
  createdBy: { email: string; name: string | null } | null;
  isCurrent: boolean;
};

export type ImageBBoxWorkflowStatus =
  | "NO_BBOXES"
  | "BBOX_DRAFT"
  | "BBOX_CONFIRMED"
  | "BBOX_NEEDS_UPDATE";

export type ImageBBoxWorkflowState = {
  bboxSetStatus: ImageBBoxWorkflowStatus;
  persistedStatus: "DRAFT" | "CONFIRMED" | "NEEDS_UPDATE" | null;
  activeBBoxCount: number;
  confirmedAt: string | null;
  confirmedBy: { id: string; email: string; name: string | null } | null;
  lastBBoxChangeAt: string | null;
  lastBBoxVersionId: string | null;
  canConfirm: boolean;
  canEdit: boolean;
};

export type DerivedSliceCrop = {
  id: string;
  sourceImageId: string;
  sourceImageChecksum: string | null;
  sourceImageWidth: number;
  sourceImageHeight: number;
  sliceInstanceId: string;
  bboxVersionId: string;
  version: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  paddingRequestedPx: number;
  paddingAppliedLeftPx: number;
  paddingAppliedTopPx: number;
  paddingAppliedRightPx: number;
  paddingAppliedBottomPx: number;
  paddingClipped: boolean;
  coordinateSpace: "CROP_PIXEL";
  transformToSource: unknown;
  checksum: string | null;
  contentType: string | null;
  byteSize: number;
  format: string;
  createdAt: string;
  createdBy: { email: string; name: string | null } | null;
  assetUrl: string;
};

export type SliceClassValue =
  | "SAP_HEARTWOOD_SLICE"
  | "COPPER_SLICE"
  | "UNKNOWN"
  | "REVIEW_REQUIRED";
export type ReviewStateValue = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SUPERSEDED";
export type ReviewAction = "submit" | "approve" | "reject";
export type CropWorkflowReadinessStatus = "READY" | "PARTIAL" | "NOT_READY" | "REVIEW_REQUIRED";
export type CropSupportGeometrySource = "EXPLICIT_SUPPORT_MASK" | "SEMANTIC_FOREGROUND";
export type CropWorkflowNextAction =
  | "OPEN_SUPPORT_EDITOR"
  | "OPEN_SEMANTIC_EDITOR"
  | "REVIEW_SUPPORT_MASK"
  | "REVIEW_SEMANTIC_MASK"
  | "REVIEW_CLASSIFICATION"
  | "REGENERATE_CROP_OR_REVIEW_LINEAGE";
export type CropReviewActions = {
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
};
export type SliceClassificationSourceValue = "MANUAL" | "AUTO_FROM_SEMANTIC_MASK";
export type SliceClassificationDerivationReasonValue =
  | "COPPER_PIXELS_PRESENT"
  | "SAP_HEARTWOOD_PIXELS_PRESENT"
  | "NO_CLASSIFYING_PIXELS"
  | "UNKNOWN_PIXELS_PRESENT"
  | "SEMANTIC_MODE_LABEL_CONFLICT";

export type SerializedSliceClassification = {
  id: string;
  version: number;
  class: SliceClassValue;
  reviewState: string;
  source: SliceClassificationSourceValue;
  derivationReason: SliceClassificationDerivationReasonValue | null;
  derivedFromSemanticMaskVersionId: string | null;
  derivedFromSupportMaskVersionId: string | null;
  derivedFromCropId: string | null;
  labelSchemaVersionId: string;
  createdAt: string;
  createdBy: { email: string; name: string | null } | null;
};

export type CropReadinessVersion = {
  id: string;
  version: number;
  reviewState: ReviewStateValue;
  createdAt: string;
  createdBy: { email: string; name: string | null } | null;
};

export type CropReadinessArtifactVersion = CropReadinessVersion & {
  width: number;
  height: number;
  coordinateSpace: "CROP_PIXEL" | string;
  derivedCropId: string | null;
  sliceInstanceId: string | null;
  supportMaskVersionId?: string | null;
  cropSemanticMode?: "SAP_HEARTWOOD" | "COPPER" | null;
};

export type CropWorkflowReadinessCandidate = {
  crop: DerivedSliceCrop & { projectId: string };
  sourceImage: {
    id: string;
    filename: string | null;
    contentType?: string | null;
    size?: number | null;
    checksum: string | null;
    width: number | null;
    height: number | null;
    uploadedAt: string;
  };
  supportMask: CropReadinessArtifactVersion | null;
  semanticMask: CropReadinessArtifactVersion | null;
  classification: SerializedSliceClassification | null;
  latestSupportMask: CropReadinessArtifactVersion | null;
  latestSemanticMask: CropReadinessArtifactVersion | null;
  latestClassification: SerializedSliceClassification | null;
  supportMaskVersionId: string | null;
  semanticMaskVersionId: string | null;
  classificationVersionId: string | null;
  latestSupportMaskVersionId: string | null;
  latestSemanticMaskVersionId: string | null;
  latestClassificationVersionId: string | null;
  supportGeometrySource: CropSupportGeometrySource | null;
  readinessStatus: CropWorkflowReadinessStatus;
  readinessReasons: string[];
  nextActions: CropWorkflowNextAction[];
  reviewActions: {
    supportMask: CropReviewActions | null;
    semanticMask: CropReviewActions | null;
    classification: CropReviewActions | null;
  };
};

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
    source?: SliceClassificationSourceValue;
    derivationReason?: SliceClassificationDerivationReasonValue | null;
    derivedFromSemanticMaskVersionId?: string | null;
    derivedFromSupportMaskVersionId?: string | null;
    derivedFromCropId?: string | null;
    createdAt: string;
    createdBy: { email: string; name: string | null } | null;
  } | null;
};

export type CropSupportMaskState = {
  crop: DerivedSliceCrop & { projectId: string };
  myRole: string;
  canEdit: boolean;
  labelSchemaVersionId: string;
  supportLabels: { background: number; sliceSupport: number };
  exists: boolean;
  latestSupportMask: {
    id: string;
    version: number;
    size: number;
    checksum: string | null;
    contentType: string | null;
    width: number;
    height: number;
    format: string;
    reviewState: string;
    coordinateSpace: "CROP_PIXEL";
    derivedCropId: string | null;
    sliceInstanceId: string | null;
    createdAt: string;
    createdBy: { email: string; name: string | null } | null;
    reviewActions: CropReviewActions;
    url: string;
  } | null;
  supportReadiness: {
    status: string;
    label: string;
    semanticCropAnnotation: string;
    exportReady: boolean;
  };
  cropReadiness: CropWorkflowReadinessCandidate | null;
};

export type CropSemanticMode = "SAP_HEARTWOOD" | "COPPER";
export type CropSemanticSupportPolicy = Record<
  CropSemanticMode,
  {
    supportRequiredForDraftSave: boolean;
    supportRequiredForReadinessExport: boolean;
    supportGeometrySource: CropSupportGeometrySource;
  }
>;

export type CropSemanticMaskState = {
  crop: DerivedSliceCrop & { projectId: string };
  myRole: string;
  canEdit: boolean;
  labelSchemaVersionId: string;
  supportRequired: boolean;
  supportPolicy: CropSemanticSupportPolicy;
  semanticLabels: Record<
    CropSemanticMode,
    {
      labels: Array<{
        stableId: string;
        value: number;
        name: string;
        colorToken: string | null;
        isTrainable: boolean;
      }>;
      allowedValues: number[];
      backgroundValue: number;
      primaryValues: Record<string, number | null>;
    }
  >;
  currentSupportMask: {
    id: string;
    version: number;
    size: number;
    checksum: string | null;
    contentType: string | null;
    width: number;
    height: number;
    format: string;
    reviewState: string;
    coordinateSpace: "CROP_PIXEL";
    derivedCropId: string | null;
    sliceInstanceId: string | null;
    createdAt: string;
    createdBy: { email: string; name: string | null } | null;
    reviewActions: CropReviewActions;
    url: string;
  } | null;
  latestSemanticMasks: Record<
    CropSemanticMode,
    {
      id: string;
      version: number;
      size: number;
      checksum: string | null;
      contentType: string | null;
      width: number;
      height: number;
      format: string;
      reviewState: string;
      coordinateSpace: "CROP_PIXEL";
      derivedCropId: string | null;
      sliceInstanceId: string | null;
      supportMaskVersionId: string | null;
      semanticMode: CropSemanticMode | null;
      createdAt: string;
      createdBy: { email: string; name: string | null } | null;
      reviewActions: CropReviewActions;
      url: string;
    } | null
  >;
  semanticReadiness: {
    status: string;
    label: string;
    supportMaskVersionId: string | null;
    canSaveDraft: boolean;
    supportPolicy: CropSemanticSupportPolicy;
    latestSemanticVersions?: Record<CropSemanticMode, number | null>;
  };
  latestClassification: SerializedSliceClassification | null;
  cropReadiness: CropWorkflowReadinessCandidate | null;
  classificationDerivation?: {
    ok: boolean;
    semanticMaskVersionId: string | null;
    error?: string;
    reason?: SliceClassificationDerivationReasonValue;
    classifyingPixelThreshold?: number;
    classification?: SerializedSliceClassification;
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
