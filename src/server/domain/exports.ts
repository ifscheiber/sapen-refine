import crypto from "crypto";
import path from "path";
import JSZip from "jszip";
import {
  AnnotationArtifactKind,
  ExportTarget,
  type AnnotationProjectRole,
  type ArtifactReviewState,
  type Prisma,
  PrismaClient,
} from "@prisma/client";

import { canExportTraining } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import { getObjectBytes, putObject } from "@/server/storage/s3";
import { normalizeChecksum } from "@/server/uploads/integrity";

type ExportDb = PrismaClient | Prisma.TransactionClient;

export type ApiExportTarget =
  | "semantic_segmentation"
  | "support_segmentation"
  | "slice_classification"
  | "combined"
  | "crop_training";

type CropReadinessStatus = "READY" | "PARTIAL" | "NOT_READY";

type ReviewApproval = {
  decisionId: string;
  approvedBy: {
    id: string;
    email: string;
    name: string | null;
  };
  approvedAt: Date;
};

type ArtifactVersionExport = {
  id: string;
  version: number;
  storageKey: string;
  contentType: string | null;
  size: number;
  checksum: string | null;
  width: number;
  height: number;
  format: string;
  coordinateSpace: string;
  coordinateTransform: Prisma.JsonValue | null;
  labelSchemaVersionId: string;
  reviewState: ArtifactReviewState;
  derivedCropId: string | null;
  sliceInstanceId: string | null;
  supportMaskVersionId: string | null;
  cropSemanticMode: string | null;
  createdAt: Date;
  createdBy: { id: string; email: string; name: string | null } | null;
  artifact: {
    imageId: string;
    projectId: string;
    kind: AnnotationArtifactKind;
    scopeKey: string;
  };
  approval: ReviewApproval | null;
};

type ClassificationExport = {
  id: string;
  version: number;
  projectId: string;
  imageId: string;
  class: string;
  labelSchemaVersionId: string;
  sliceInstanceId: string;
  reviewState: ArtifactReviewState;
  source: string;
  derivationReason: string | null;
  derivedFromSemanticMaskVersionId: string | null;
  derivedFromSupportMaskVersionId: string | null;
  derivedFromCropId: string | null;
  createdAt: Date;
  createdBy: { id: string; email: string; name: string | null } | null;
  approval: ReviewApproval | null;
};

export type ExportCandidate = {
  image: {
    id: string;
    filename: string | null;
    contentType: string | null;
    size: number | null;
    checksum: string | null;
    width: number | null;
    height: number | null;
    storageKey: string;
    uploadedAt: Date;
  };
  acquisitionMetadata: {
    cameraDevice: string | null;
    lensObjective: string | null;
    exposure: string | null;
    aperture: string | null;
    iso: string | null;
    whiteBalance: string | null;
    colorProfile: string | null;
    lightingSetup: string | null;
    capturedBy: string | null;
    capturedAt: Date | null;
    notes: string | null;
  } | null;
  sampleMetadata: {
    tNumber: string | null;
    specimenIdentifier: string | null;
    sliceIndex: number | null;
    replicate: string | null;
    treatmentReference: string | null;
    notes: string | null;
  } | null;
  semanticMask: ArtifactVersionExport | null;
  supportMask: ArtifactVersionExport | null;
  classification: ClassificationExport | null;
  warnings: string[];
  eligibleTargets: ApiExportTarget[];
};

type CropExportCandidate = {
  crop: {
    id: string;
    projectId: string;
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
    coordinateSpace: string;
    transformToSourceJson: Prisma.JsonValue;
    storageKey: string;
    checksum: string | null;
    contentType: string | null;
    byteSize: number;
    format: string;
    createdAt: Date;
    createdBy: { id: string; email: string; name: string | null } | null;
    sourceImage: ExportCandidate["image"] & {
      acquisitionMetadata: ExportCandidate["acquisitionMetadata"];
      sampleMetadata: ExportCandidate["sampleMetadata"];
    };
    bboxVersion: {
      id: string;
      version: number;
      x: number;
      y: number;
      width: number;
      height: number;
      coordinateSpace: string;
      status: string;
      createdAt: Date;
    };
  };
  supportMask: ArtifactVersionExport | null;
  semanticMask: ArtifactVersionExport | null;
  classification: ClassificationExport | null;
  readinessStatus: CropReadinessStatus;
  readinessReasons: string[];
};

export class TrainingExportError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

const TARGETS = new Set<ApiExportTarget>([
  "semantic_segmentation",
  "support_segmentation",
  "slice_classification",
  "combined",
  "crop_training",
]);

const TRAINING_EXPORT_MANIFEST_VERSION = "sapen-annotate-training-export-v1";
const CROP_TRAINING_EXPORT_MANIFEST_VERSION = "sapen-annotate-crop-training-export-v1";

const ARTIFACT_SELECT = {
  id: true,
  version: true,
  storageKey: true,
  contentType: true,
  size: true,
  checksum: true,
  width: true,
  height: true,
  format: true,
  coordinateSpace: true,
  coordinateTransform: true,
  labelSchemaVersionId: true,
  reviewState: true,
  derivedCropId: true,
  sliceInstanceId: true,
  supportMaskVersionId: true,
  cropSemanticMode: true,
  createdAt: true,
  createdBy: { select: { id: true, email: true, name: true } },
  artifact: { select: { imageId: true, projectId: true, kind: true, scopeKey: true } },
} satisfies Prisma.AnnotationArtifactVersionSelect;

const CLASSIFICATION_SELECT = {
  id: true,
  version: true,
  projectId: true,
  imageId: true,
  class: true,
  labelSchemaVersionId: true,
  sliceInstanceId: true,
  reviewState: true,
  source: true,
  derivationReason: true,
  derivedFromSemanticMaskVersionId: true,
  derivedFromSupportMaskVersionId: true,
  derivedFromCropId: true,
  createdAt: true,
  createdBy: { select: { id: true, email: true, name: true } },
} satisfies Prisma.SliceClassificationVersionSelect;

export function parseExportTargets(value: unknown): ApiExportTarget[] {
  if (!Array.isArray(value)) throw new TrainingExportError("EXPORT_TARGETS_REQUIRED");

  const parsed: ApiExportTarget[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !TARGETS.has(item as ApiExportTarget)) {
      throw new TrainingExportError("EXPORT_TARGET_INVALID");
    }
    if (!parsed.includes(item as ApiExportTarget)) parsed.push(item as ApiExportTarget);
  }

  if (parsed.length === 0) throw new TrainingExportError("EXPORT_TARGETS_REQUIRED");
  if (parsed.includes("crop_training") && parsed.length > 1) {
    throw new TrainingExportError("EXPORT_TARGET_COMBINATION_INVALID");
  }
  return parsed;
}

function canExport(role: AnnotationProjectRole) {
  return canExportTraining(role);
}

function sha256(bytes: Uint8Array | string) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function safeExtension(filename: string | null, contentType: string | null, fallback: string) {
  const ext = filename ? path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  if (ext) return ext;
  if (contentType === "image/png") return ".png";
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/svg+xml") return ".svg";
  return fallback;
}

function targetForSelection(targets: ApiExportTarget[]): ExportTarget {
  if (targets.length !== 1) return ExportTarget.COMBINED_MANIFEST;
  if (targets[0] === "semantic_segmentation") return ExportTarget.SEMANTIC_SEGMENTATION;
  if (targets[0] === "support_segmentation") return ExportTarget.INSTANCE_SUPPORT_SEGMENTATION;
  if (targets[0] === "slice_classification") return ExportTarget.SLICE_CLASSIFICATION;
  if (targets[0] === "crop_training") return ExportTarget.CROP_TRAINING;
  return ExportTarget.COMBINED_MANIFEST;
}

function isCropTrainingSelection(targets: ApiExportTarget[]) {
  return targets.length === 1 && targets[0] === "crop_training";
}

async function getProjectMembership(db: ExportDb, projectId: string, userId: string) {
  const project = await db.annotationProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      labelSchemaVersionId: true,
      labelSchemaVersion: { select: { id: true, name: true, version: true, status: true } },
      members: { where: { userId }, select: { role: true } },
    },
  });

  if (!project) throw new TrainingExportError("PROJECT_NOT_FOUND");
  const membership = project.members[0];
  if (!membership) throw new TrainingExportError("FORBIDDEN");

  return { project, membership };
}

async function loadApprovalForArtifactVersion(db: ExportDb, artifactVersionId: string) {
  const decision = await db.reviewDecision.findFirst({
    where: { artifactVersionId, toState: "APPROVED" },
    orderBy: { reviewedAt: "desc" },
    select: {
      id: true,
      reviewedAt: true,
      reviewedBy: { select: { id: true, email: true, name: true } },
    },
  });
  if (!decision) return null;

  return {
    decisionId: decision.id,
    approvedAt: decision.reviewedAt,
    approvedBy: decision.reviewedBy,
  };
}

async function loadApprovalForClassification(db: ExportDb, sliceClassificationVersionId: string) {
  const decision = await db.reviewDecision.findFirst({
    where: { sliceClassificationVersionId, toState: "APPROVED" },
    orderBy: { reviewedAt: "desc" },
    select: {
      id: true,
      reviewedAt: true,
      reviewedBy: { select: { id: true, email: true, name: true } },
    },
  });
  if (!decision) return null;

  return {
    decisionId: decision.id,
    approvedAt: decision.reviewedAt,
    approvedBy: decision.reviewedBy,
  };
}

async function loadLatestApprovedArtifact(params: {
  db: ExportDb;
  imageId: string;
  kind: AnnotationArtifactKind;
}) {
  const artifact = await params.db.annotationArtifact.findUnique({
    where: {
      imageId_kind_scopeKey: {
        imageId: params.imageId,
        kind: params.kind,
        scopeKey: "default",
      },
    },
    select: { id: true },
  });
  if (!artifact) return null;

  const version = await params.db.annotationArtifactVersion.findFirst({
    where: {
      artifactId: artifact.id,
      reviewState: "APPROVED" satisfies ArtifactReviewState,
    },
    orderBy: { version: "desc" },
    select: ARTIFACT_SELECT,
  });
  if (!version) return null;

  return {
    ...version,
    approval: await loadApprovalForArtifactVersion(params.db, version.id),
  };
}

async function loadLatestApprovedClassification(db: ExportDb, imageId: string) {
  const version = await db.sliceClassificationVersion.findFirst({
    where: { imageId, reviewState: "APPROVED" },
    orderBy: { version: "desc" },
    select: CLASSIFICATION_SELECT,
  });
  if (!version) return null;

  return {
    ...version,
    approval: await loadApprovalForClassification(db, version.id),
  };
}

const CROP_SELECT = {
  id: true,
  projectId: true,
  sourceImageId: true,
  sourceImageChecksum: true,
  sourceImageWidth: true,
  sourceImageHeight: true,
  sliceInstanceId: true,
  bboxVersionId: true,
  version: true,
  sourceX: true,
  sourceY: true,
  sourceWidth: true,
  sourceHeight: true,
  cropX: true,
  cropY: true,
  cropWidth: true,
  cropHeight: true,
  paddingRequestedPx: true,
  paddingAppliedLeftPx: true,
  paddingAppliedTopPx: true,
  paddingAppliedRightPx: true,
  paddingAppliedBottomPx: true,
  paddingClipped: true,
  coordinateSpace: true,
  transformToSourceJson: true,
  storageKey: true,
  checksum: true,
  contentType: true,
  byteSize: true,
  format: true,
  createdAt: true,
  createdBy: { select: { id: true, email: true, name: true } },
  sourceImage: {
    select: {
      id: true,
      filename: true,
      contentType: true,
      size: true,
      checksum: true,
      width: true,
      height: true,
      storageKey: true,
      uploadedAt: true,
      acquisitionMetadata: {
        select: {
          cameraDevice: true,
          lensObjective: true,
          exposure: true,
          aperture: true,
          iso: true,
          whiteBalance: true,
          colorProfile: true,
          lightingSetup: true,
          capturedBy: true,
          capturedAt: true,
          notes: true,
        },
      },
      sampleMetadata: {
        select: {
          tNumber: true,
          specimenIdentifier: true,
          sliceIndex: true,
          replicate: true,
          treatmentReference: true,
          notes: true,
        },
      },
    },
  },
  bboxVersion: {
    select: {
      id: true,
      version: true,
      x: true,
      y: true,
      width: true,
      height: true,
      coordinateSpace: true,
      status: true,
      createdAt: true,
    },
  },
} satisfies Prisma.DerivedSliceCropSelect;

async function loadLatestCropArtifactVersion(params: {
  db: ExportDb;
  projectId: string;
  imageId: string;
  cropId: string;
  sliceInstanceId: string;
  kind: AnnotationArtifactKind;
  reviewState?: ArtifactReviewState;
}) {
  const version = await params.db.annotationArtifactVersion.findFirst({
    where: {
      derivedCropId: params.cropId,
      sliceInstanceId: params.sliceInstanceId,
      ...(params.reviewState ? { reviewState: params.reviewState } : {}),
      artifact: {
        projectId: params.projectId,
        imageId: params.imageId,
        kind: params.kind,
      },
    },
    orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    select: ARTIFACT_SELECT,
  });
  if (!version) return null;

  return {
    ...version,
    approval: await loadApprovalForArtifactVersion(params.db, version.id),
  };
}

async function loadLatestCropClassificationVersion(params: {
  db: ExportDb;
  projectId: string;
  imageId: string;
  sliceInstanceId: string;
  reviewState?: ArtifactReviewState;
}) {
  const version = await params.db.sliceClassificationVersion.findFirst({
    where: {
      projectId: params.projectId,
      imageId: params.imageId,
      sliceInstanceId: params.sliceInstanceId,
      ...(params.reviewState ? { reviewState: params.reviewState } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    select: CLASSIFICATION_SELECT,
  });
  if (!version) return null;

  return {
    ...version,
    approval: await loadApprovalForClassification(params.db, version.id),
  };
}

function candidateWarnings(candidate: Omit<ExportCandidate, "warnings" | "eligibleTargets">) {
  const warnings: string[] = [];
  if (!candidate.sampleMetadata?.tNumber) warnings.push("MISSING_T_NUMBER");
  if (!candidate.acquisitionMetadata) warnings.push("MISSING_ACQUISITION_METADATA");
  if (!hasValidChecksum(candidate.image.checksum)) warnings.push("MISSING_IMAGE_CHECKSUM");
  if (!hasValidDimensions(candidate.image)) warnings.push("MISSING_IMAGE_DIMENSIONS");
  if (!candidate.semanticMask) warnings.push("MISSING_APPROVED_SEMANTIC_MASK");
  if (candidate.semanticMask && !hasValidArtifactIntegrity(candidate.semanticMask)) {
    warnings.push("MISSING_SEMANTIC_MASK_INTEGRITY_METADATA");
  }
  if (!candidate.supportMask) warnings.push("MISSING_APPROVED_SUPPORT_MASK");
  if (candidate.supportMask && !hasValidArtifactIntegrity(candidate.supportMask)) {
    warnings.push("MISSING_SUPPORT_MASK_INTEGRITY_METADATA");
  }
  if (!candidate.classification) warnings.push("MISSING_APPROVED_SLICE_CLASSIFICATION");
  return warnings;
}

function eligibleTargets(candidate: Omit<ExportCandidate, "warnings" | "eligibleTargets">) {
  const targets: ApiExportTarget[] = [];
  if (candidate.semanticMask) targets.push("semantic_segmentation");
  if (candidate.supportMask) targets.push("support_segmentation");
  if (candidate.classification) targets.push("slice_classification");
  if (targets.length > 0) targets.push("combined");
  return targets;
}

function selectedComponentAvailable(candidate: ExportCandidate, target: ApiExportTarget) {
  if (target === "semantic_segmentation") return Boolean(candidate.semanticMask);
  if (target === "support_segmentation") return Boolean(candidate.supportMask);
  if (target === "slice_classification") return Boolean(candidate.classification);
  if (target === "crop_training") return false;
  return Boolean(candidate.semanticMask || candidate.supportMask || candidate.classification);
}

function hasValidChecksum(value: string | null | undefined) {
  return Boolean(normalizeChecksum(value));
}

function hasValidDimensions(value: { width: number | null; height: number | null }) {
  return Number.isInteger(value.width) && Number.isInteger(value.height) && value.width! > 0 && value.height! > 0;
}

function hasValidArtifactIntegrity(value: ArtifactVersionExport) {
  return hasValidChecksum(value.checksum) && hasValidDimensions(value);
}

function hasPositiveInteger(value: number | null | undefined) {
  return Number.isInteger(value) && value! > 0;
}

function hasValidCropIntegrity(value: CropExportCandidate["crop"]) {
  return (
    hasValidChecksum(value.checksum) &&
    hasPositiveInteger(value.cropWidth) &&
    hasPositiveInteger(value.cropHeight) &&
    hasPositiveInteger(value.byteSize)
  );
}

function cropVersionLineageMatches(
  version: ArtifactVersionExport,
  crop: CropExportCandidate["crop"],
) {
  return (
    version.derivedCropId === crop.id &&
    version.sliceInstanceId === crop.sliceInstanceId &&
    version.artifact.imageId === crop.sourceImageId &&
    version.artifact.projectId === crop.projectId
  );
}

function cropVersionCoordinateMatches(
  version: ArtifactVersionExport,
  crop: CropExportCandidate["crop"],
) {
  return (
    version.coordinateSpace === "CROP_PIXEL" &&
    version.width === crop.cropWidth &&
    version.height === crop.cropHeight
  );
}

function cropReadinessStatus(reasons: Set<string>, hasAnyCropWork: boolean): CropReadinessStatus {
  if (reasons.size === 0) return "READY";
  return hasAnyCropWork ? "PARTIAL" : "NOT_READY";
}

function evaluateCropReadiness(params: {
  crop: CropExportCandidate["crop"];
  supportAny: ArtifactVersionExport | null;
  supportApproved: ArtifactVersionExport | null;
  semanticAny: ArtifactVersionExport | null;
  semanticApproved: ArtifactVersionExport | null;
  classificationAny: ClassificationExport | null;
  classificationApproved: ClassificationExport | null;
}) {
  const reasons = new Set<string>();
  const {
    crop,
    supportAny,
    supportApproved,
    semanticAny,
    semanticApproved,
    classificationAny,
    classificationApproved,
  } = params;

  if (!hasValidChecksum(crop.sourceImage.checksum)) reasons.add("MISSING_IMAGE_CHECKSUM");
  if (!hasValidDimensions(crop.sourceImage)) reasons.add("MISSING_IMAGE_DIMENSIONS");
  if (!hasValidCropIntegrity(crop)) reasons.add("MISSING_CROP_INTEGRITY_METADATA");
  if (crop.coordinateSpace !== "CROP_PIXEL") reasons.add("COORDINATE_SPACE_MISMATCH");
  if (crop.sourceImageId !== crop.sourceImage.id) reasons.add("LINEAGE_MISMATCH");

  if (!supportApproved) reasons.add(supportAny ? "SUPPORT_NOT_APPROVED" : "MISSING_SUPPORT_MASK");
  if (!semanticApproved) reasons.add(semanticAny ? "SEMANTIC_NOT_APPROVED" : "MISSING_SEMANTIC_MASK");
  if (!classificationApproved) {
    reasons.add(classificationAny ? "CLASSIFICATION_NOT_APPROVED" : "MISSING_CLASSIFICATION");
  }

  if (supportApproved) {
    if (!hasValidArtifactIntegrity(supportApproved)) {
      reasons.add("MISSING_SUPPORT_MASK_INTEGRITY_METADATA");
    }
    if (!cropVersionCoordinateMatches(supportApproved, crop)) {
      reasons.add("COORDINATE_SPACE_MISMATCH");
    }
    if (!cropVersionLineageMatches(supportApproved, crop)) {
      reasons.add("LINEAGE_MISMATCH");
    }
  }

  if (semanticApproved) {
    if (!hasValidArtifactIntegrity(semanticApproved)) {
      reasons.add("MISSING_SEMANTIC_MASK_INTEGRITY_METADATA");
    }
    if (!cropVersionCoordinateMatches(semanticApproved, crop)) {
      reasons.add("COORDINATE_SPACE_MISMATCH");
    }
    if (!cropVersionLineageMatches(semanticApproved, crop)) {
      reasons.add("LINEAGE_MISMATCH");
    }
    if (supportApproved && semanticApproved.supportMaskVersionId !== supportApproved.id) {
      reasons.add("LINEAGE_MISMATCH");
    }
  }

  if (classificationApproved) {
    if (
      classificationApproved.projectId !== crop.projectId ||
      classificationApproved.imageId !== crop.sourceImageId ||
      classificationApproved.sliceInstanceId !== crop.sliceInstanceId ||
      classificationApproved.derivedFromCropId !== crop.id
    ) {
      reasons.add("LINEAGE_MISMATCH");
    }
    if (semanticApproved && classificationApproved.derivedFromSemanticMaskVersionId !== semanticApproved.id) {
      reasons.add("LINEAGE_MISMATCH");
    }
    if (supportApproved && classificationApproved.derivedFromSupportMaskVersionId !== supportApproved.id) {
      reasons.add("LINEAGE_MISMATCH");
    }
  }

  const hasAnyCropWork = Boolean(
    supportAny ||
      supportApproved ||
      semanticAny ||
      semanticApproved ||
      classificationAny ||
      classificationApproved,
  );
  return {
    status: cropReadinessStatus(reasons, hasAnyCropWork),
    reasons: Array.from(reasons).sort(),
  };
}

async function resolveCropExportCandidates(db: ExportDb, projectId: string) {
  const crops = await db.derivedSliceCrop.findMany({
    where: { projectId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: CROP_SELECT,
  });

  const candidates: CropExportCandidate[] = [];
  for (const crop of crops) {
    const artifactParams = {
      db,
      projectId: crop.projectId,
      imageId: crop.sourceImageId,
      cropId: crop.id,
      sliceInstanceId: crop.sliceInstanceId,
    };
    const classificationParams = {
      db,
      projectId: crop.projectId,
      imageId: crop.sourceImageId,
      sliceInstanceId: crop.sliceInstanceId,
    };
    const [
      supportAny,
      supportApproved,
      semanticAny,
      semanticApproved,
      classificationAny,
      classificationApproved,
    ] = await Promise.all([
      loadLatestCropArtifactVersion({
        ...artifactParams,
        kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      }),
      loadLatestCropArtifactVersion({
        ...artifactParams,
        kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
        reviewState: "APPROVED",
      }),
      loadLatestCropArtifactVersion({
        ...artifactParams,
        kind: AnnotationArtifactKind.SEMANTIC_MASK,
      }),
      loadLatestCropArtifactVersion({
        ...artifactParams,
        kind: AnnotationArtifactKind.SEMANTIC_MASK,
        reviewState: "APPROVED",
      }),
      loadLatestCropClassificationVersion(classificationParams),
      loadLatestCropClassificationVersion({
        ...classificationParams,
        reviewState: "APPROVED",
      }),
    ]);

    const readiness = evaluateCropReadiness({
      crop,
      supportAny,
      supportApproved,
      semanticAny,
      semanticApproved,
      classificationAny,
      classificationApproved,
    });
    candidates.push({
      crop,
      supportMask: supportApproved,
      semanticMask: semanticApproved,
      classification: classificationApproved,
      readinessStatus: readiness.status,
      readinessReasons: readiness.reasons,
    });
  }

  return candidates;
}

function selectedIntegrityWarnings(candidate: ExportCandidate, targets: ApiExportTarget[]) {
  const warnings: string[] = [];
  if (!targets.some((target) => selectedComponentAvailable(candidate, target))) return warnings;

  if (!hasValidChecksum(candidate.image.checksum)) warnings.push("MISSING_IMAGE_CHECKSUM");
  if (!hasValidDimensions(candidate.image)) warnings.push("MISSING_IMAGE_DIMENSIONS");

  const needsSemantic = targets.includes("semantic_segmentation") || targets.includes("combined");
  const needsSupport = targets.includes("support_segmentation") || targets.includes("combined");

  if (needsSemantic && candidate.semanticMask && !hasValidArtifactIntegrity(candidate.semanticMask)) {
    warnings.push("MISSING_SEMANTIC_MASK_INTEGRITY_METADATA");
  }
  if (needsSupport && candidate.supportMask && !hasValidArtifactIntegrity(candidate.supportMask)) {
    warnings.push("MISSING_SUPPORT_MASK_INTEGRITY_METADATA");
  }
  return warnings;
}

function hasBlockingIntegrityWarnings(manifest: { warnings: Array<{ code: string }> }) {
  return manifest.warnings.some((warning) =>
    [
      "MISSING_IMAGE_CHECKSUM",
      "MISSING_IMAGE_DIMENSIONS",
      "MISSING_SEMANTIC_MASK_INTEGRITY_METADATA",
      "MISSING_SUPPORT_MASK_INTEGRITY_METADATA",
    ].includes(warning.code),
  );
}

function warningsForSelectedTargets(candidate: ExportCandidate, targets: ApiExportTarget[]) {
  const warnings: string[] = [];
  const needsSemantic = targets.includes("semantic_segmentation") || targets.includes("combined");
  const needsSupport = targets.includes("support_segmentation") || targets.includes("combined");
  const needsClassification = targets.includes("slice_classification") || targets.includes("combined");

  if (needsSemantic && !candidate.semanticMask) warnings.push("MISSING_APPROVED_SEMANTIC_MASK");
  if (needsSupport && !candidate.supportMask) warnings.push("MISSING_APPROVED_SUPPORT_MASK");
  if (needsClassification && !candidate.classification) {
    warnings.push("MISSING_APPROVED_SLICE_CLASSIFICATION");
  }
  if (!candidate.sampleMetadata?.tNumber) warnings.push("MISSING_T_NUMBER");
  if (!candidate.acquisitionMetadata) warnings.push("MISSING_ACQUISITION_METADATA");
  warnings.push(...selectedIntegrityWarnings(candidate, targets));
  return warnings;
}

export async function resolveProjectExportReadiness(params: {
  projectId: string;
  userId: string;
}, db: ExportDb = prisma) {
  const { project, membership } = await getProjectMembership(db, params.projectId, params.userId);
  const images = await db.imageAsset.findMany({
    where: { projectId: project.id },
    orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      filename: true,
      contentType: true,
      size: true,
      checksum: true,
      width: true,
      height: true,
      storageKey: true,
      uploadedAt: true,
      acquisitionMetadata: {
        select: {
          cameraDevice: true,
          lensObjective: true,
          exposure: true,
          aperture: true,
          iso: true,
          whiteBalance: true,
          colorProfile: true,
          lightingSetup: true,
          capturedBy: true,
          capturedAt: true,
          notes: true,
        },
      },
      sampleMetadata: {
        select: {
          tNumber: true,
          specimenIdentifier: true,
          sliceIndex: true,
          replicate: true,
          treatmentReference: true,
          notes: true,
        },
      },
    },
  });

  const candidates: ExportCandidate[] = [];
  for (const image of images) {
    const base = {
      image,
      acquisitionMetadata: image.acquisitionMetadata,
      sampleMetadata: image.sampleMetadata,
      semanticMask: await loadLatestApprovedArtifact({
        db,
        imageId: image.id,
        kind: AnnotationArtifactKind.SEMANTIC_MASK,
      }),
      supportMask: await loadLatestApprovedArtifact({
        db,
        imageId: image.id,
        kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      }),
      classification: await loadLatestApprovedClassification(db, image.id),
    };
    candidates.push({
      ...base,
      warnings: candidateWarnings(base),
      eligibleTargets: eligibleTargets(base),
    });
  }
  const cropCandidates = await resolveCropExportCandidates(db, project.id);

  return {
    project: {
      id: project.id,
      name: project.name,
      labelSchemaVersion: project.labelSchemaVersion,
    },
    myRole: membership.role,
    canExport: canExport(membership.role),
    summary: {
      totalImages: candidates.length,
      approvedSemanticMasks: candidates.filter((candidate) => candidate.semanticMask).length,
      approvedSupportMasks: candidates.filter((candidate) => candidate.supportMask).length,
      approvedClassifications: candidates.filter((candidate) => candidate.classification).length,
      imagesWithWarnings: candidates.filter((candidate) => candidate.warnings.length > 0).length,
      totalCropItems: cropCandidates.length,
      readyCropItems: cropCandidates.filter((candidate) => candidate.readinessStatus === "READY").length,
      partialCropItems: cropCandidates.filter((candidate) => candidate.readinessStatus === "PARTIAL").length,
      notReadyCropItems: cropCandidates.filter((candidate) => candidate.readinessStatus === "NOT_READY").length,
      cropItemsWithWarnings: cropCandidates.filter((candidate) => candidate.readinessReasons.length > 0).length,
    },
    candidates,
    cropCandidates,
  };
}

function packagePaths(candidate: ExportCandidate) {
  const imageExt = safeExtension(candidate.image.filename, candidate.image.contentType, ".bin");
  return {
    image: `images/${candidate.image.id}${imageExt}`,
    semanticMask: `masks/semantic/${candidate.image.id}.u8raw`,
    supportMask: `masks/support/${candidate.image.id}.u8raw`,
  };
}

function cropPackagePaths(candidate: CropExportCandidate) {
  const imageExt = safeExtension(
    candidate.crop.sourceImage.filename,
    candidate.crop.sourceImage.contentType,
    ".bin",
  );
  const cropExt = candidate.crop.contentType === "image/png" || candidate.crop.format === "png"
    ? ".png"
    : ".bin";
  return {
    originalImage: `original-images/${candidate.crop.sourceImage.id}${imageExt}`,
    derivedCrop: `crops/${candidate.crop.id}${cropExt}`,
    supportMask:
      candidate.supportMask
        ? `masks/support-crop/${candidate.crop.sliceInstanceId}_${candidate.supportMask.id}.u8raw`
        : null,
    semanticMask:
      candidate.semanticMask
        ? `masks/semantic-crop/${candidate.crop.sliceInstanceId}_${candidate.semanticMask.id}.u8raw`
        : null,
  };
}

function userManifest(user: { id: string; email: string; name: string | null } | null) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

function approvalManifest(approval: ReviewApproval | null) {
  if (!approval) return null;
  return {
    decisionId: approval.decisionId,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt.toISOString(),
  };
}

function artifactManifest(version: ArtifactVersionExport, filePath: string) {
  return {
    artifactVersionId: version.id,
    version: version.version,
    path: filePath,
    checksum: version.checksum,
    size: version.size,
    width: version.width,
    height: version.height,
    format: version.format,
    coordinateSpace: version.coordinateSpace,
    labelSchemaVersionId: version.labelSchemaVersionId,
    createdBy: userManifest(version.createdBy),
    createdAt: version.createdAt.toISOString(),
  };
}

function cropArtifactManifest(version: ArtifactVersionExport, filePath: string) {
  return {
    ...artifactManifest(version, filePath),
    reviewState: version.reviewState,
    derivedCropId: version.derivedCropId,
    sliceInstanceId: version.sliceInstanceId,
    supportMaskVersionId: version.supportMaskVersionId,
    cropSemanticMode: version.cropSemanticMode,
    approval: approvalManifest(version.approval),
  };
}

function collectLabelSchemaIds(candidates: ExportCandidate[]) {
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.semanticMask) ids.add(candidate.semanticMask.labelSchemaVersionId);
    if (candidate.supportMask) ids.add(candidate.supportMask.labelSchemaVersionId);
    if (candidate.classification) ids.add(candidate.classification.labelSchemaVersionId);
  }
  return Array.from(ids).sort();
}

function collectCropLabelSchemaIds(candidates: CropExportCandidate[]) {
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.supportMask) ids.add(candidate.supportMask.labelSchemaVersionId);
    if (candidate.semanticMask) ids.add(candidate.semanticMask.labelSchemaVersionId);
    if (candidate.classification) ids.add(candidate.classification.labelSchemaVersionId);
  }
  return Array.from(ids).sort();
}

async function loadLabelSchemas(db: ExportDb, labelSchemaVersionIds: string[]) {
  return db.labelSchemaVersion.findMany({
    where: { id: { in: labelSchemaVersionIds } },
    orderBy: [{ name: "asc" }, { version: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      version: true,
      status: true,
      definitions: {
        orderBy: [{ sortOrder: "asc" }, { stableId: "asc" }],
        select: {
          stableId: true,
          byteValue: true,
          displayName: true,
          semanticMeaning: true,
          applicability: true,
          colorToken: true,
          sortOrder: true,
          isTrainable: true,
        },
      },
    },
  });
}

async function buildManifest(params: {
  db: ExportDb;
  exportId: string;
  exportedAt: Date;
  exportedBy: { id: string; email: string; name: string | null };
  project: { id: string; name: string };
  targets: ApiExportTarget[];
  candidates: ExportCandidate[];
}) {
  const includedCandidates = params.candidates.filter((candidate) =>
    params.targets.some((target) => selectedComponentAvailable(candidate, target)),
  );
  const skippedCandidates = params.candidates.filter(
    (candidate) => !includedCandidates.some((included) => included.image.id === candidate.image.id),
  );
  const labelSchemas = await loadLabelSchemas(params.db, collectLabelSchemaIds(includedCandidates));

  const items = includedCandidates.map((candidate) => {
    const paths = packagePaths(candidate);
    const includeSemantic =
      Boolean(candidate.semanticMask) &&
      (params.targets.includes("semantic_segmentation") || params.targets.includes("combined"));
    const includeSupport =
      Boolean(candidate.supportMask) &&
      (params.targets.includes("support_segmentation") || params.targets.includes("combined"));
    const includeClassification =
      Boolean(candidate.classification) &&
      (params.targets.includes("slice_classification") || params.targets.includes("combined"));

    return {
      image: {
        id: candidate.image.id,
        filename: candidate.image.filename,
        path: paths.image,
        contentType: candidate.image.contentType,
        size: candidate.image.size,
        width: candidate.image.width,
        height: candidate.image.height,
        checksum: candidate.image.checksum,
        uploadedAt: candidate.image.uploadedAt.toISOString(),
      },
      acquisitionMetadata: candidate.acquisitionMetadata
        ? {
            ...candidate.acquisitionMetadata,
            capturedAt: candidate.acquisitionMetadata.capturedAt?.toISOString() ?? null,
          }
        : null,
      sampleMetadata: candidate.sampleMetadata,
      semanticMask: includeSemantic && candidate.semanticMask
        ? artifactManifest(candidate.semanticMask, paths.semanticMask)
        : null,
      supportMask: includeSupport && candidate.supportMask
        ? artifactManifest(candidate.supportMask, paths.supportMask)
        : null,
      classification: includeClassification && candidate.classification
        ? {
            classificationVersionId: candidate.classification.id,
            version: candidate.classification.version,
            class: candidate.classification.class,
            sliceInstanceId: candidate.classification.sliceInstanceId,
            labelSchemaVersionId: candidate.classification.labelSchemaVersionId,
            createdBy: userManifest(candidate.classification.createdBy),
            createdAt: candidate.classification.createdAt.toISOString(),
          }
        : null,
      review: {
        semanticMaskApproval:
          includeSemantic && candidate.semanticMask
            ? approvalManifest(candidate.semanticMask.approval)
            : null,
        supportMaskApproval:
          includeSupport && candidate.supportMask
            ? approvalManifest(candidate.supportMask.approval)
            : null,
        classificationApproval:
          includeClassification && candidate.classification
            ? approvalManifest(candidate.classification.approval)
            : null,
      },
      eligibleTargets: candidate.eligibleTargets,
      warnings: warningsForSelectedTargets(candidate, params.targets),
    };
  });

  const warnings = [
    ...items.flatMap((item) =>
      item.warnings.map((warning) => ({
        imageId: item.image.id,
        code: warning,
      })),
    ),
    ...skippedCandidates.map((candidate) => ({
      imageId: candidate.image.id,
      code: "NO_REQUESTED_APPROVED_DATA",
    })),
  ];

  return {
    manifestVersion: TRAINING_EXPORT_MANIFEST_VERSION,
    exportId: params.exportId,
    exportedAt: params.exportedAt.toISOString(),
    exportedBy: params.exportedBy,
    project: params.project,
    selection: {
      targets: params.targets,
      approvedOnly: true,
    },
    labelSchemas,
    items,
    skippedImages: skippedCandidates.map((candidate) => ({
      imageId: candidate.image.id,
      filename: candidate.image.filename,
      warnings: ["NO_REQUESTED_APPROVED_DATA"],
    })),
    warnings,
    summary: {
      itemCount: items.length,
      skippedImageCount: skippedCandidates.length,
      warningCount: warnings.length,
    },
  };
}

async function buildCropTrainingManifest(params: {
  db: ExportDb;
  exportId: string;
  exportedAt: Date;
  exportedBy: { id: string; email: string; name: string | null };
  project: { id: string; name: string };
  candidates: CropExportCandidate[];
}) {
  const readyCandidates = params.candidates.filter(
    (candidate) =>
      candidate.readinessStatus === "READY" &&
      candidate.supportMask &&
      candidate.semanticMask &&
      candidate.classification,
  );
  const skippedCandidates = params.candidates.filter(
    (candidate) => !readyCandidates.some((included) => included.crop.id === candidate.crop.id),
  );
  const labelSchemas = await loadLabelSchemas(params.db, collectCropLabelSchemaIds(readyCandidates));

  const cropItems = readyCandidates.flatMap((candidate) => {
    const paths = cropPackagePaths(candidate);
    if (!candidate.supportMask || !candidate.semanticMask || !candidate.classification) return [];
    if (!paths.supportMask || !paths.semanticMask) return [];

    return [
      {
        originalImage: {
          id: candidate.crop.sourceImage.id,
          filename: candidate.crop.sourceImage.filename,
          path: paths.originalImage,
          contentType: candidate.crop.sourceImage.contentType,
          size: candidate.crop.sourceImage.size,
          width: candidate.crop.sourceImage.width,
          height: candidate.crop.sourceImage.height,
          checksum: candidate.crop.sourceImage.checksum,
          uploadedAt: candidate.crop.sourceImage.uploadedAt.toISOString(),
        },
        acquisitionMetadata: candidate.crop.sourceImage.acquisitionMetadata
          ? {
              ...candidate.crop.sourceImage.acquisitionMetadata,
              capturedAt:
                candidate.crop.sourceImage.acquisitionMetadata.capturedAt?.toISOString() ?? null,
            }
          : null,
        sampleMetadata: candidate.crop.sourceImage.sampleMetadata,
        sliceInstanceId: candidate.crop.sliceInstanceId,
        sliceBoundingBox: {
          bboxVersionId: candidate.crop.bboxVersionId,
          version: candidate.crop.bboxVersion.version,
          x: candidate.crop.bboxVersion.x,
          y: candidate.crop.bboxVersion.y,
          width: candidate.crop.bboxVersion.width,
          height: candidate.crop.bboxVersion.height,
          coordinateSpace: candidate.crop.bboxVersion.coordinateSpace,
          status: candidate.crop.bboxVersion.status,
          createdAt: candidate.crop.bboxVersion.createdAt.toISOString(),
        },
        derivedCrop: {
          id: candidate.crop.id,
          version: candidate.crop.version,
          path: paths.derivedCrop,
          sourceImageId: candidate.crop.sourceImageId,
          sourceImageChecksum: candidate.crop.sourceImageChecksum,
          sourceImageWidth: candidate.crop.sourceImageWidth,
          sourceImageHeight: candidate.crop.sourceImageHeight,
          sourceRect: {
            x: candidate.crop.sourceX,
            y: candidate.crop.sourceY,
            width: candidate.crop.sourceWidth,
            height: candidate.crop.sourceHeight,
          },
          cropRect: {
            x: candidate.crop.cropX,
            y: candidate.crop.cropY,
            width: candidate.crop.cropWidth,
            height: candidate.crop.cropHeight,
          },
          padding: {
            requestedPx: candidate.crop.paddingRequestedPx,
            appliedLeftPx: candidate.crop.paddingAppliedLeftPx,
            appliedTopPx: candidate.crop.paddingAppliedTopPx,
            appliedRightPx: candidate.crop.paddingAppliedRightPx,
            appliedBottomPx: candidate.crop.paddingAppliedBottomPx,
            clipped: candidate.crop.paddingClipped,
          },
          coordinateSpace: candidate.crop.coordinateSpace,
          transformToSource: candidate.crop.transformToSourceJson,
          checksum: candidate.crop.checksum,
          contentType: candidate.crop.contentType,
          byteSize: candidate.crop.byteSize,
          format: candidate.crop.format,
          createdBy: userManifest(candidate.crop.createdBy),
          createdAt: candidate.crop.createdAt.toISOString(),
        },
        supportMask: cropArtifactManifest(candidate.supportMask, paths.supportMask),
        semanticMask: cropArtifactManifest(candidate.semanticMask, paths.semanticMask),
        classification: {
          classificationVersionId: candidate.classification.id,
          version: candidate.classification.version,
          class: candidate.classification.class,
          source: candidate.classification.source,
          derivationReason: candidate.classification.derivationReason,
          sliceInstanceId: candidate.classification.sliceInstanceId,
          labelSchemaVersionId: candidate.classification.labelSchemaVersionId,
          derivedFromSemanticMaskVersionId:
            candidate.classification.derivedFromSemanticMaskVersionId,
          derivedFromSupportMaskVersionId:
            candidate.classification.derivedFromSupportMaskVersionId,
          derivedFromCropId: candidate.classification.derivedFromCropId,
          reviewState: candidate.classification.reviewState,
          approval: approvalManifest(candidate.classification.approval),
          createdBy: userManifest(candidate.classification.createdBy),
          createdAt: candidate.classification.createdAt.toISOString(),
        },
        readinessStatus: candidate.readinessStatus,
        readinessReasons: candidate.readinessReasons,
      },
    ];
  });

  const warnings = skippedCandidates.flatMap((candidate) =>
    candidate.readinessReasons.map((reason) => ({
      derivedCropId: candidate.crop.id,
      sourceImageId: candidate.crop.sourceImageId,
      sliceInstanceId: candidate.crop.sliceInstanceId,
      code: reason,
    })),
  );

  return {
    manifestVersion: CROP_TRAINING_EXPORT_MANIFEST_VERSION,
    exportId: params.exportId,
    exportedAt: params.exportedAt.toISOString(),
    exportedBy: params.exportedBy,
    project: params.project,
    selection: {
      targets: ["crop_training"],
      approvedOnly: true,
      cropCoordinateSpace: "CROP_PIXEL",
      originalCoordinateMasks: false,
    },
    labelSchemas,
    cropItems,
    skippedCropItems: skippedCandidates.map((candidate) => ({
      derivedCropId: candidate.crop.id,
      sourceImageId: candidate.crop.sourceImageId,
      sliceInstanceId: candidate.crop.sliceInstanceId,
      bboxVersionId: candidate.crop.bboxVersionId,
      readinessStatus: candidate.readinessStatus,
      readinessReasons: candidate.readinessReasons,
      supportMaskVersionId: candidate.supportMask?.id ?? null,
      semanticMaskVersionId: candidate.semanticMask?.id ?? null,
      classificationVersionId: candidate.classification?.id ?? null,
    })),
    warnings,
    summary: {
      cropItemCount: cropItems.length,
      skippedCropItemCount: skippedCandidates.length,
      warningCount: warnings.length,
      totalCropItems: params.candidates.length,
      readyCropItems: cropItems.length,
      partialCropItems: params.candidates.filter((candidate) => candidate.readinessStatus === "PARTIAL").length,
      notReadyCropItems: params.candidates.filter((candidate) => candidate.readinessStatus === "NOT_READY").length,
    },
  };
}

async function buildZipPackage(params: {
  manifest: Awaited<ReturnType<typeof buildManifest>>;
  candidates: ExportCandidate[];
  targets: ApiExportTarget[];
}) {
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(params.manifest, null, 2));

  for (const item of params.manifest.items) {
    const candidate = params.candidates.find((entry) => entry.image.id === item.image.id);
    if (!candidate) continue;

    zip.file(item.image.path, await getObjectBytes(candidate.image.storageKey));
    if (item.semanticMask && candidate.semanticMask) {
      zip.file(item.semanticMask.path, await getObjectBytes(candidate.semanticMask.storageKey));
    }
    if (item.supportMask && candidate.supportMask) {
      zip.file(item.supportMask.path, await getObjectBytes(candidate.supportMask.storageKey));
    }
  }

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

async function buildCropTrainingZipPackage(params: {
  manifest: Awaited<ReturnType<typeof buildCropTrainingManifest>>;
  candidates: CropExportCandidate[];
}) {
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(params.manifest, null, 2));

  for (const item of params.manifest.cropItems) {
    const candidate = params.candidates.find((entry) => entry.crop.id === item.derivedCrop.id);
    if (!candidate?.supportMask || !candidate.semanticMask) continue;

    zip.file(item.originalImage.path, await getObjectBytes(candidate.crop.sourceImage.storageKey));
    zip.file(item.derivedCrop.path, await getObjectBytes(candidate.crop.storageKey));
    zip.file(item.supportMask.path, await getObjectBytes(candidate.supportMask.storageKey));
    zip.file(item.semanticMask.path, await getObjectBytes(candidate.semanticMask.storageKey));
  }

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

function sanitizeExportBatch(batch: {
  id: string;
  projectId: string;
  target: ExportTarget;
  status: string;
  manifestChecksum: string | null;
  selectionCriteria: Prisma.JsonValue | null;
  warnings: Prisma.JsonValue | null;
  metadataSummary: Prisma.JsonValue | null;
  exportedAt: Date;
  createdAt: Date;
  _count?: { items: number };
}) {
  const metadata =
    batch.metadataSummary && typeof batch.metadataSummary === "object" && !Array.isArray(batch.metadataSummary)
      ? batch.metadataSummary as Record<string, unknown>
      : {};
  const warningList = Array.isArray(batch.warnings) ? batch.warnings : [];

  return {
    id: batch.id,
    projectId: batch.projectId,
    target: batch.target,
    status: batch.status,
    manifestChecksum: batch.manifestChecksum,
    packageChecksum: typeof metadata.packageChecksum === "string" ? metadata.packageChecksum : null,
    itemCount: batch._count?.items ?? (typeof metadata.itemCount === "number" ? metadata.itemCount : 0),
    warningCount: warningList.length,
    selection: batch.selectionCriteria,
    exportedAt: batch.exportedAt,
    createdAt: batch.createdAt,
    downloads:
      batch.status === "COMPLETED"
        ? {
            manifest: `/api/exports/${batch.id}/download?file=manifest`,
            package: `/api/exports/${batch.id}/download?file=package`,
          }
        : null,
  };
}

export function sanitizeReadiness(
  readiness: Awaited<ReturnType<typeof resolveProjectExportReadiness>>,
) {
  return {
    ...readiness,
    candidates: readiness.candidates.map((candidate) => ({
      image: {
        id: candidate.image.id,
        filename: candidate.image.filename,
        contentType: candidate.image.contentType,
        size: candidate.image.size,
        checksum: candidate.image.checksum,
        width: candidate.image.width,
        height: candidate.image.height,
        uploadedAt: candidate.image.uploadedAt,
      },
      semanticMaskVersionId: candidate.semanticMask?.id ?? null,
      supportMaskVersionId: candidate.supportMask?.id ?? null,
      classificationVersionId: candidate.classification?.id ?? null,
      eligibleTargets: candidate.eligibleTargets,
      warnings: candidate.warnings,
    })),
    cropCandidates: readiness.cropCandidates.map((candidate) => ({
      crop: {
        id: candidate.crop.id,
        sourceImageId: candidate.crop.sourceImageId,
        sliceInstanceId: candidate.crop.sliceInstanceId,
        bboxVersionId: candidate.crop.bboxVersionId,
        version: candidate.crop.version,
        sourceX: candidate.crop.sourceX,
        sourceY: candidate.crop.sourceY,
        sourceWidth: candidate.crop.sourceWidth,
        sourceHeight: candidate.crop.sourceHeight,
        cropX: candidate.crop.cropX,
        cropY: candidate.crop.cropY,
        cropWidth: candidate.crop.cropWidth,
        cropHeight: candidate.crop.cropHeight,
        paddingRequestedPx: candidate.crop.paddingRequestedPx,
        paddingAppliedLeftPx: candidate.crop.paddingAppliedLeftPx,
        paddingAppliedTopPx: candidate.crop.paddingAppliedTopPx,
        paddingAppliedRightPx: candidate.crop.paddingAppliedRightPx,
        paddingAppliedBottomPx: candidate.crop.paddingAppliedBottomPx,
        paddingClipped: candidate.crop.paddingClipped,
        coordinateSpace: candidate.crop.coordinateSpace,
        transformToSource: candidate.crop.transformToSourceJson,
        checksum: candidate.crop.checksum,
        contentType: candidate.crop.contentType,
        byteSize: candidate.crop.byteSize,
        format: candidate.crop.format,
        createdAt: candidate.crop.createdAt,
      },
      sourceImage: {
        id: candidate.crop.sourceImage.id,
        filename: candidate.crop.sourceImage.filename,
        checksum: candidate.crop.sourceImage.checksum,
        width: candidate.crop.sourceImage.width,
        height: candidate.crop.sourceImage.height,
        uploadedAt: candidate.crop.sourceImage.uploadedAt,
      },
      supportMaskVersionId: candidate.supportMask?.id ?? null,
      semanticMaskVersionId: candidate.semanticMask?.id ?? null,
      classificationVersionId: candidate.classification?.id ?? null,
      readinessStatus: candidate.readinessStatus,
      readinessReasons: candidate.readinessReasons,
    })),
  };
}

async function createCropTrainingExportBatch(params: {
  readiness: Awaited<ReturnType<typeof resolveProjectExportReadiness>>;
  user: { id: string; email: string; name: string | null };
}, db: PrismaClient) {
  const selectionCriteria = {
    targets: ["crop_training"],
    approvedOnly: true,
    cropCoordinateSpace: "CROP_PIXEL",
    originalCoordinateMasks: false,
  };

  const batch = await db.exportBatch.create({
    data: {
      projectId: params.readiness.project.id,
      target: ExportTarget.CROP_TRAINING,
      status: "CREATED",
      manifestFormatVersion: CROP_TRAINING_EXPORT_MANIFEST_VERSION,
      selectionCriteria,
      exportedById: params.user.id,
    },
    select: {
      id: true,
      exportedAt: true,
      createdAt: true,
    },
  });

  try {
    const manifest = await buildCropTrainingManifest({
      db,
      exportId: batch.id,
      exportedAt: batch.exportedAt,
      exportedBy: params.user,
      project: { id: params.readiness.project.id, name: params.readiness.project.name },
      candidates: params.readiness.cropCandidates,
    });
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    const packageBytes = await buildCropTrainingZipPackage({
      manifest,
      candidates: params.readiness.cropCandidates,
    });

    const exportPrefix = `projects/${params.readiness.project.id}/exports/${batch.id}`;
    const manifestStorageKey = `${exportPrefix}/manifest.json`;
    const packageStorageKey = `${exportPrefix}/package.zip`;
    await putObject(manifestStorageKey, manifestBytes, "application/json");
    await putObject(packageStorageKey, packageBytes, "application/zip");

    const exportItems = manifest.cropItems.flatMap((item) => {
      const rows: Prisma.ExportItemCreateManyExportBatchInput[] = [
        {
          role: "original-image",
          imageId: item.originalImage.id,
          derivedCropId: item.derivedCrop.id,
        },
        {
          role: "derived-crop",
          imageId: item.originalImage.id,
          derivedCropId: item.derivedCrop.id,
        },
        {
          role: "crop-support-mask",
          imageId: item.originalImage.id,
          artifactVersionId: item.supportMask.artifactVersionId,
          derivedCropId: item.derivedCrop.id,
        },
        {
          role: "crop-semantic-mask",
          imageId: item.originalImage.id,
          artifactVersionId: item.semanticMask.artifactVersionId,
          derivedCropId: item.derivedCrop.id,
        },
        {
          role: "crop-slice-classification",
          imageId: item.originalImage.id,
          sliceClassificationVersionId: item.classification.classificationVersionId,
          derivedCropId: item.derivedCrop.id,
        },
      ];
      return rows;
    });

    const completed = await db.exportBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMPLETED",
        manifestStorageKey,
        manifestChecksum: sha256(manifestBytes),
        warnings: manifest.warnings,
        metadataSummary: {
          itemCount: manifest.summary.cropItemCount,
          cropItemCount: manifest.summary.cropItemCount,
          skippedCropItemCount: manifest.summary.skippedCropItemCount,
          warningCount: manifest.summary.warningCount,
          packageStorageKey,
          packageChecksum: sha256(packageBytes),
          packageSize: packageBytes.byteLength,
        },
        ...(exportItems.length
          ? {
              items: {
                createMany: {
                  data: exportItems,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        projectId: true,
        target: true,
        status: true,
        manifestChecksum: true,
        selectionCriteria: true,
        warnings: true,
        metadataSummary: true,
        exportedAt: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    });

    await recordAuditEvent({
      action: "EXPORT_CREATED",
      entity: "ExportBatch",
      entityId: completed.id,
      actorId: params.user.id,
      details: {
        projectId: completed.projectId,
        target: completed.target,
        manifestChecksum: completed.manifestChecksum,
        packageChecksum: sanitizeExportBatch(completed).packageChecksum,
        manifestFormatVersion: CROP_TRAINING_EXPORT_MANIFEST_VERSION,
      },
    }, db);

    return sanitizeExportBatch(completed);
  } catch (error) {
    await db.exportBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        warnings: [
          {
            code: error instanceof TrainingExportError ? error.code : "EXPORT_GENERATION_FAILED",
            message: error instanceof Error ? error.message : "Unknown export failure",
          },
        ],
      },
    }).catch(() => undefined);
    throw error;
  }
}

export async function createTrainingExportForUser(params: {
  projectId: string;
  userId: string;
  targets: ApiExportTarget[];
}, db: PrismaClient = prisma) {
  const readiness = await resolveProjectExportReadiness(
    { projectId: params.projectId, userId: params.userId },
    db,
  );
  if (!readiness.canExport) throw new TrainingExportError("FORBIDDEN");

  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) throw new TrainingExportError("USER_NOT_FOUND");

  if (isCropTrainingSelection(params.targets)) {
    return createCropTrainingExportBatch({ readiness, user }, db);
  }

  const selectionCriteria = {
    targets: params.targets,
    approvedOnly: true,
  };

  const batch = await db.exportBatch.create({
    data: {
      projectId: readiness.project.id,
      target: targetForSelection(params.targets),
      status: "CREATED",
      manifestFormatVersion: TRAINING_EXPORT_MANIFEST_VERSION,
      selectionCriteria,
      exportedById: user.id,
    },
    select: {
      id: true,
      exportedAt: true,
      createdAt: true,
    },
  });

  try {
    const manifest = await buildManifest({
      db,
      exportId: batch.id,
      exportedAt: batch.exportedAt,
      exportedBy: user,
      project: { id: readiness.project.id, name: readiness.project.name },
      targets: params.targets,
      candidates: readiness.candidates,
    });
    if (hasBlockingIntegrityWarnings(manifest)) {
      throw new TrainingExportError("EXPORT_INTEGRITY_METADATA_MISSING");
    }
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    const packageBytes = await buildZipPackage({
      manifest,
      candidates: readiness.candidates,
      targets: params.targets,
    });

    const exportPrefix = `projects/${readiness.project.id}/exports/${batch.id}`;
    const manifestStorageKey = `${exportPrefix}/manifest.json`;
    const packageStorageKey = `${exportPrefix}/package.zip`;
    await putObject(manifestStorageKey, manifestBytes, "application/json");
    await putObject(packageStorageKey, packageBytes, "application/zip");

    const exportItems = manifest.items.flatMap((item) => {
      const rows: Prisma.ExportItemCreateManyExportBatchInput[] = [
        { role: "image", imageId: item.image.id },
      ];
      if (item.semanticMask) {
        rows.push({
          role: "semantic-mask",
          imageId: item.image.id,
          artifactVersionId: item.semanticMask.artifactVersionId,
        });
      }
      if (item.supportMask) {
        rows.push({
          role: "support-mask",
          imageId: item.image.id,
          artifactVersionId: item.supportMask.artifactVersionId,
        });
      }
      if (item.classification) {
        rows.push({
          role: "slice-classification",
          imageId: item.image.id,
          sliceClassificationVersionId: item.classification.classificationVersionId,
        });
      }
      return rows;
    });

    const completed = await db.exportBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMPLETED",
        manifestStorageKey,
        manifestChecksum: sha256(manifestBytes),
        warnings: manifest.warnings,
        metadataSummary: {
          itemCount: manifest.summary.itemCount,
          skippedImageCount: manifest.summary.skippedImageCount,
          warningCount: manifest.summary.warningCount,
          packageStorageKey,
          packageChecksum: sha256(packageBytes),
          packageSize: packageBytes.byteLength,
        },
        ...(exportItems.length
          ? {
              items: {
                createMany: {
                  data: exportItems,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        projectId: true,
        target: true,
        status: true,
        manifestChecksum: true,
        selectionCriteria: true,
        warnings: true,
        metadataSummary: true,
        exportedAt: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    });

    await recordAuditEvent({
      action: "EXPORT_CREATED",
      entity: "ExportBatch",
      entityId: completed.id,
      actorId: user.id,
      details: {
        projectId: completed.projectId,
        target: completed.target,
        manifestChecksum: completed.manifestChecksum,
        packageChecksum: sanitizeExportBatch(completed).packageChecksum,
      },
    }, db);

    return sanitizeExportBatch(completed);
  } catch (error) {
    await db.exportBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        warnings: [
          {
            code: error instanceof TrainingExportError ? error.code : "EXPORT_GENERATION_FAILED",
            message: error instanceof Error ? error.message : "Unknown export failure",
          },
        ],
      },
    }).catch(() => undefined);
    throw error;
  }
}

async function loadExportForUser(params: {
  exportId: string;
  userId: string;
}, db: ExportDb = prisma) {
  const batch = await db.exportBatch.findUnique({
    where: { id: params.exportId },
    select: {
      id: true,
      projectId: true,
      target: true,
      status: true,
      manifestStorageKey: true,
      manifestChecksum: true,
      selectionCriteria: true,
      warnings: true,
      metadataSummary: true,
      exportedAt: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
  if (!batch) throw new TrainingExportError("EXPORT_NOT_FOUND");
  if (batch.target === ExportTarget.PREDICTION_ANALYSIS) {
    throw new TrainingExportError("EXPORT_NOT_FOUND");
  }

  const membership = await db.annotationProjectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: batch.projectId,
        userId: params.userId,
      },
    },
    select: { role: true },
  });
  if (!membership || !canExport(membership.role)) throw new TrainingExportError("FORBIDDEN");

  return batch;
}

export async function getTrainingExportForUser(params: {
  exportId: string;
  userId: string;
}, db: ExportDb = prisma) {
  const batch = await loadExportForUser(params, db);
  return sanitizeExportBatch(batch);
}

export async function readTrainingExportFileForUser(params: {
  exportId: string;
  userId: string;
  file: "manifest" | "package";
}, db: ExportDb = prisma) {
  const batch = await loadExportForUser(params, db);
  if (batch.status !== "COMPLETED") throw new TrainingExportError("EXPORT_NOT_READY");

  const metadata =
    batch.metadataSummary && typeof batch.metadataSummary === "object" && !Array.isArray(batch.metadataSummary)
      ? batch.metadataSummary as Record<string, unknown>
      : {};
  const key =
    params.file === "manifest"
      ? batch.manifestStorageKey
      : typeof metadata.packageStorageKey === "string"
        ? metadata.packageStorageKey
        : null;
  if (!key) throw new TrainingExportError("EXPORT_FILE_NOT_FOUND");

  const bytes = await getObjectBytes(key);
  await recordAuditEvent({
    action: "EXPORT_DOWNLOADED",
    entity: "ExportBatch",
    entityId: batch.id,
    actorId: params.userId,
    details: { projectId: batch.projectId, file: params.file, size: bytes.byteLength },
  }, db);

  return {
    bytes,
    filename:
      params.file === "manifest"
        ? `sapen-export-${batch.id}-manifest.json`
        : `sapen-export-${batch.id}.zip`,
    contentType: params.file === "manifest" ? "application/json" : "application/zip",
  };
}

export function exportErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof TrainingExportError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code.endsWith("_NOT_FOUND") || error.code === "PROJECT_NOT_FOUND"
          ? 404
          : error.code === "EXPORT_NOT_READY"
            ? 409
            : 400;
    return { error: error.code, status };
  }

  return { error: "TRAINING_EXPORT_FAILED", status: 500 };
}
