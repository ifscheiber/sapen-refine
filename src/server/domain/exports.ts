import { randomUUID } from "crypto";
import path from "path";
import {
  AnnotationArtifactKind,
  ExportTarget,
  ExportStatus,
  ArtifactReviewState,
  type AnnotationProjectRole,
  type Prisma,
  PrismaClient,
} from "@prisma/client";

import { canExportTraining, canViewProjectExports } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import {
  APPROVED_SNAPSHOT_FRESHNESS_POLICY,
  isApprovedSnapshotOutdated,
  isApprovedSnapshotOutdatedReasonCode,
} from "@/server/domain/approvedSnapshotFreshness";
import { recordAuditEvent } from "@/server/domain/audit";
import {
  resolveCropWorkflowReadiness,
  sanitizeCropWorkflowCandidate,
  type CropWorkflowCandidate,
} from "@/server/domain/cropReadiness";
import {
  ExportObjectIntegrityError,
} from "@/server/domain/exportObjectIntegrity";
import {
  deleteExportManifestObjectBestEffort,
  deleteExportPackageObjectsBestEffort,
  type ExportManifestWriteResult,
  type ExportPackageSource,
  verifyExportPackageSources,
  writeExportManifestObject,
  writeExportPackageObjects,
} from "@/server/domain/exportPackageWriter";
import {
  assertExportWithinTrialCaps,
  ExportTrialCapError,
  trainingExportTrialLimits,
} from "@/server/domain/exportTrialCaps";
import {
  buildSapenCnnTrainingSnapshot,
  SAPEN_CNN_TRAINING_MANIFEST_VERSION,
  SAPEN_CNN_TRAINING_TARGET,
  sapenCnnTrainingExportItemsFromManifest,
} from "@/server/domain/sapenCnnTrainingSnapshot";
import { getRuntimeConfig } from "@/server/runtime/config";
import { getObjectBytes } from "@/server/storage/s3";
import { normalizeChecksum } from "@/server/uploads/integrity";

type ExportDb = PrismaClient | Prisma.TransactionClient;

export type ApiExportTarget =
  | "semantic_segmentation"
  | "support_segmentation"
  | "slice_classification"
  | "combined"
  | "crop_training"
  | typeof SAPEN_CNN_TRAINING_TARGET;

export type ApiExportPackageMode = "zip" | "manifest_only";

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
  latestSemanticMask: ArtifactVersionExport | null;
  latestSupportMask: ArtifactVersionExport | null;
  latestClassification: ClassificationExport | null;
  warnings: string[];
  eligibleTargets: ApiExportTarget[];
};

type CropExportCandidate = CropWorkflowCandidate;

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
  SAPEN_CNN_TRAINING_TARGET,
]);

const TRAINING_EXPORT_MANIFEST_VERSION = "sapen-annotate-training-export-v1";
const CROP_TRAINING_EXPORT_MANIFEST_VERSION = "sapen-annotate-crop-training-export-v1";

const EXPORT_BATCH_SANITIZE_SELECT = {
  id: true,
  projectId: true,
  target: true,
  status: true,
  manifestChecksum: true,
  manifestFormatVersion: true,
  packageChecksum: true,
  selectionCriteria: true,
  warnings: true,
  metadataSummary: true,
  exportedAt: true,
  createdAt: true,
  jobAttemptCount: true,
  jobMaxAttempts: true,
  nextRetryAt: true,
  processorId: true,
  processorRunId: true,
  leaseExpiresAt: true,
  processingStartedAt: true,
  completedAt: true,
  failedAt: true,
  errorCode: true,
  errorMessage: true,
  _count: { select: { items: true } },
} satisfies Prisma.ExportBatchSelect;

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
  if (parsed.includes(SAPEN_CNN_TRAINING_TARGET) && parsed.length > 1) {
    throw new TrainingExportError("EXPORT_TARGET_COMBINATION_INVALID");
  }
  return parsed;
}

function canExport(role: AnnotationProjectRole) {
  return canExportTraining(role);
}

const EXPORT_JOB_PACKAGE_WRITER = "jszip-verified-v1";
const EXPORT_JOB_MANIFEST_WRITER = "manifest-only-verified-sources-v1";

export function parseExportPackageMode(value: unknown): ApiExportPackageMode {
  if (value === undefined || value === null || value === "") return "zip";
  if (value === "zip" || value === "manifest_only") return value;
  throw new TrainingExportError("EXPORT_PACKAGE_MODE_INVALID");
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

function isSapenCnnTrainingSelection(targets: ApiExportTarget[]) {
  return targets.length === 1 && targets[0] === SAPEN_CNN_TRAINING_TARGET;
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

async function loadLatestArtifact(params: {
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
      reviewState: { not: ArtifactReviewState.SUPERSEDED },
    },
    orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    select: ARTIFACT_SELECT,
  });
  if (!version) return null;

  return {
    ...version,
    approval:
      version.reviewState === ArtifactReviewState.APPROVED
        ? await loadApprovalForArtifactVersion(params.db, version.id)
        : null,
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

async function loadLatestClassification(db: ExportDb, imageId: string) {
  const version = await db.sliceClassificationVersion.findFirst({
    where: { imageId, reviewState: { not: ArtifactReviewState.SUPERSEDED } },
    orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    select: CLASSIFICATION_SELECT,
  });
  if (!version) return null;

  return {
    ...version,
    approval:
      version.reviewState === ArtifactReviewState.APPROVED
        ? await loadApprovalForClassification(db, version.id)
        : null,
  };
}

function freshnessWarnings(candidate: Pick<
  ExportCandidate,
  | "semanticMask"
  | "supportMask"
  | "classification"
  | "latestSemanticMask"
  | "latestSupportMask"
  | "latestClassification"
>) {
  const warnings: string[] = [];
  if (
    isApprovedSnapshotOutdated({
      approved: candidate.semanticMask,
      latest: candidate.latestSemanticMask,
    })
  ) {
    warnings.push("SEMANTIC_APPROVED_VERSION_OUTDATED");
  }
  if (
    isApprovedSnapshotOutdated({
      approved: candidate.supportMask,
      latest: candidate.latestSupportMask,
    })
  ) {
    warnings.push("SUPPORT_APPROVED_VERSION_OUTDATED");
  }
  if (
    isApprovedSnapshotOutdated({
      approved: candidate.classification,
      latest: candidate.latestClassification,
    })
  ) {
    warnings.push("CLASSIFICATION_APPROVED_VERSION_OUTDATED");
  }
  return warnings;
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
  warnings.push(...freshnessWarnings(candidate));
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

function hasBlockingFreshnessWarnings(manifest: { warnings: Array<{ code: string }> }) {
  return manifest.warnings.some((warning) => isApprovedSnapshotOutdatedReasonCode(warning.code));
}

function hasBlockingCropFreshnessReasons(candidates: CropExportCandidate[]) {
  return candidates.some((candidate) =>
    candidate.readinessReasons.some((reason) => isApprovedSnapshotOutdatedReasonCode(reason)),
  );
}

function safeByteSize(value: number | null | undefined) {
  return Number.isFinite(value) && value && value > 0 ? value : 0;
}

function warningsForSelectedTargets(candidate: ExportCandidate, targets: ApiExportTarget[]) {
  const warnings: string[] = [];
  const needsSemantic = targets.includes("semantic_segmentation") || targets.includes("combined");
  const needsSupport = targets.includes("support_segmentation") || targets.includes("combined");
  const needsClassification = targets.includes("slice_classification") || targets.includes("combined");
  const staleWarnings = freshnessWarnings(candidate);

  if (needsSemantic && !candidate.semanticMask) warnings.push("MISSING_APPROVED_SEMANTIC_MASK");
  if (needsSupport && !candidate.supportMask) warnings.push("MISSING_APPROVED_SUPPORT_MASK");
  if (needsClassification && !candidate.classification) {
    warnings.push("MISSING_APPROVED_SLICE_CLASSIFICATION");
  }
  if (needsSemantic) {
    warnings.push(
      ...staleWarnings.filter((warning) => warning === "SEMANTIC_APPROVED_VERSION_OUTDATED"),
    );
  }
  if (needsSupport) {
    warnings.push(
      ...staleWarnings.filter((warning) => warning === "SUPPORT_APPROVED_VERSION_OUTDATED"),
    );
  }
  if (needsClassification) {
    warnings.push(
      ...staleWarnings.filter((warning) => warning === "CLASSIFICATION_APPROVED_VERSION_OUTDATED"),
    );
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
  if (!canViewProjectExports(membership.role)) throw new TrainingExportError("FORBIDDEN");

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
      latestSemanticMask: await loadLatestArtifact({
        db,
        imageId: image.id,
        kind: AnnotationArtifactKind.SEMANTIC_MASK,
      }),
      latestSupportMask: await loadLatestArtifact({
        db,
        imageId: image.id,
        kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      }),
      latestClassification: await loadLatestClassification(db, image.id),
    };
    candidates.push({
      ...base,
      warnings: candidateWarnings(base),
      eligibleTargets: eligibleTargets(base),
    });
  }
  const cropReadiness = await resolveCropWorkflowReadiness({ projectId: project.id }, db);
  const cropCandidates = cropReadiness.candidates;

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
      ...cropReadiness.summary,
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
      approvedSnapshotFreshnessPolicy: APPROVED_SNAPSHOT_FRESHNESS_POLICY,
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
      candidate.supportGeometrySource &&
      (candidate.supportGeometrySource === "SEMANTIC_FOREGROUND" || candidate.supportMask) &&
      candidate.semanticMask &&
      candidate.classification,
  );
  const skippedCandidates = params.candidates.filter(
    (candidate) => !readyCandidates.some((included) => included.crop.id === candidate.crop.id),
  );
  const labelSchemas = await loadLabelSchemas(params.db, collectCropLabelSchemaIds(readyCandidates));

  const cropItems = readyCandidates.flatMap((candidate) => {
    const paths = cropPackagePaths(candidate);
    if (!candidate.semanticMask || !candidate.classification) return [];
    if (!paths.semanticMask) return [];
    if (candidate.supportGeometrySource === "EXPLICIT_SUPPORT_MASK" && !paths.supportMask) return [];
    if (candidate.supportGeometrySource === "SEMANTIC_FOREGROUND") {
      paths.supportMask = null;
    }

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
        supportGeometry: {
          source: candidate.supportGeometrySource,
          supportMaskVersionId:
            candidate.supportGeometrySource === "EXPLICIT_SUPPORT_MASK"
              ? candidate.supportMask?.id ?? null
              : null,
          semanticMaskVersionId:
            candidate.supportGeometrySource === "SEMANTIC_FOREGROUND" ? candidate.semanticMask.id : null,
        },
        supportMask:
          candidate.supportMask && paths.supportMask
            ? cropArtifactManifest(candidate.supportMask, paths.supportMask)
            : null,
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
      approvedSnapshotFreshnessPolicy: APPROVED_SNAPSHOT_FRESHNESS_POLICY,
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
      supportGeometrySource: candidate.supportGeometrySource,
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
      reviewRequiredCropItems: params.candidates.filter(
        (candidate) => candidate.readinessStatus === "REVIEW_REQUIRED",
      ).length,
    },
  };
}

function buildTrainingPackageSources(params: {
  manifest: Awaited<ReturnType<typeof buildManifest>>;
  candidates: ExportCandidate[];
}) {
  const sources: ExportPackageSource[] = [];

  for (const item of params.manifest.items) {
    const candidate = params.candidates.find((entry) => entry.image.id === item.image.id);
    if (!candidate) continue;

    sources.push({
      path: item.image.path,
      storageKey: candidate.image.storageKey,
      expectedChecksum: candidate.image.checksum ?? null,
      expectedSize: candidate.image.size ?? null,
      resourceType: "ImageAsset",
      resourceId: candidate.image.id,
    });
    if (item.semanticMask && candidate.semanticMask) {
      sources.push({
        path: item.semanticMask.path,
        storageKey: candidate.semanticMask.storageKey,
        expectedChecksum: candidate.semanticMask.checksum ?? null,
        expectedSize: candidate.semanticMask.size ?? null,
        resourceType: "AnnotationArtifactVersion",
        resourceId: candidate.semanticMask.id,
      });
    }
    if (item.supportMask && candidate.supportMask) {
      sources.push({
        path: item.supportMask.path,
        storageKey: candidate.supportMask.storageKey,
        expectedChecksum: candidate.supportMask.checksum ?? null,
        expectedSize: candidate.supportMask.size ?? null,
        resourceType: "AnnotationArtifactVersion",
        resourceId: candidate.supportMask.id,
      });
    }
  }

  return sources;
}

function estimateTrainingExportBytes(params: {
  manifest: Awaited<ReturnType<typeof buildManifest>>;
  candidates: ExportCandidate[];
  manifestBytes: Uint8Array;
}) {
  let total = params.manifestBytes.byteLength;
  for (const item of params.manifest.items) {
    const candidate = params.candidates.find((entry) => entry.image.id === item.image.id);
    if (!candidate) continue;
    total += safeByteSize(candidate.image.size);
    if (item.semanticMask && candidate.semanticMask) {
      total += safeByteSize(candidate.semanticMask.size);
    }
    if (item.supportMask && candidate.supportMask) {
      total += safeByteSize(candidate.supportMask.size);
    }
  }
  return total;
}

function assertTrainingExportCaps(params: {
  manifest: Awaited<ReturnType<typeof buildManifest>>;
  candidates: ExportCandidate[];
  manifestBytes: Uint8Array;
}) {
  assertExportWithinTrialCaps({
    metrics: {
      itemCount: params.manifest.summary.itemCount,
      estimatedBytes: estimateTrainingExportBytes(params),
    },
    limits: trainingExportTrialLimits(),
    itemCode: "EXPORT_ITEM_LIMIT_EXCEEDED",
    byteCode: "EXPORT_BYTE_LIMIT_EXCEEDED",
  });
}

function buildCropTrainingPackageSources(params: {
  manifest: Awaited<ReturnType<typeof buildCropTrainingManifest>>;
  candidates: CropExportCandidate[];
}) {
  const sources: ExportPackageSource[] = [];

  for (const item of params.manifest.cropItems) {
    const candidate = params.candidates.find((entry) => entry.crop.id === item.derivedCrop.id);
    if (!candidate?.semanticMask) continue;

    sources.push({
      path: item.originalImage.path,
      storageKey: candidate.crop.sourceImage.storageKey,
      expectedChecksum: candidate.crop.sourceImage.checksum ?? null,
      expectedSize: candidate.crop.sourceImage.size ?? null,
      resourceType: "ImageAsset",
      resourceId: candidate.crop.sourceImage.id,
    });
    sources.push({
      path: item.derivedCrop.path,
      storageKey: candidate.crop.storageKey,
      expectedChecksum: candidate.crop.checksum ?? null,
      expectedSize: candidate.crop.byteSize ?? null,
      resourceType: "DerivedSliceCrop",
      resourceId: candidate.crop.id,
    });
    if (item.supportMask && candidate.supportMask) {
      sources.push({
        path: item.supportMask.path,
        storageKey: candidate.supportMask.storageKey,
        expectedChecksum: candidate.supportMask.checksum ?? null,
        expectedSize: candidate.supportMask.size ?? null,
        resourceType: "AnnotationArtifactVersion",
        resourceId: candidate.supportMask.id,
      });
    }
    sources.push({
      path: item.semanticMask.path,
      storageKey: candidate.semanticMask.storageKey,
      expectedChecksum: candidate.semanticMask.checksum ?? null,
      expectedSize: candidate.semanticMask.size ?? null,
      resourceType: "AnnotationArtifactVersion",
      resourceId: candidate.semanticMask.id,
    });
  }

  return sources;
}

function estimateCropTrainingExportBytes(params: {
  manifest: Awaited<ReturnType<typeof buildCropTrainingManifest>>;
  candidates: CropExportCandidate[];
  manifestBytes: Uint8Array;
}) {
  let total = params.manifestBytes.byteLength;
  for (const item of params.manifest.cropItems) {
    const candidate = params.candidates.find((entry) => entry.crop.id === item.derivedCrop.id);
    if (!candidate?.semanticMask) continue;
    total += safeByteSize(candidate.crop.sourceImage.size);
    total += safeByteSize(candidate.crop.byteSize);
    if (item.supportMask && candidate.supportMask) {
      total += safeByteSize(candidate.supportMask.size);
    }
    total += safeByteSize(candidate.semanticMask.size);
  }
  return total;
}

function assertCropTrainingExportCaps(params: {
  manifest: Awaited<ReturnType<typeof buildCropTrainingManifest>>;
  candidates: CropExportCandidate[];
  manifestBytes: Uint8Array;
}) {
  assertExportWithinTrialCaps({
    metrics: {
      itemCount: params.manifest.summary.cropItemCount,
      estimatedBytes: estimateCropTrainingExportBytes(params),
    },
    limits: trainingExportTrialLimits(),
    itemCode: "EXPORT_ITEM_LIMIT_EXCEEDED",
    byteCode: "EXPORT_BYTE_LIMIT_EXCEEDED",
  });
}

function estimateSourceBytes(params: {
  manifestBytes: Uint8Array;
  sources: ExportPackageSource[];
}) {
  return params.sources.reduce(
    (total, source) => total + safeByteSize(source.expectedSize),
    params.manifestBytes.byteLength,
  );
}

function metadataRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readManifestSnapshot(metadata: Record<string, unknown>) {
  const manifest = metadata.manifestSnapshot;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new TrainingExportError("EXPORT_JOB_SNAPSHOT_MISSING");
  }
  return manifest;
}

function readPackageSources(metadata: Record<string, unknown>): ExportPackageSource[] {
  if (!Array.isArray(metadata.packageSources)) {
    throw new TrainingExportError("EXPORT_JOB_SNAPSHOT_MISSING");
  }
  return metadata.packageSources.map((source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new TrainingExportError("EXPORT_JOB_SNAPSHOT_INVALID");
    }
    const record = source as Record<string, unknown>;
    for (const field of ["path", "storageKey", "resourceType", "resourceId"]) {
      if (typeof record[field] !== "string" || !record[field]) {
        throw new TrainingExportError("EXPORT_JOB_SNAPSHOT_INVALID");
      }
    }
    return {
      objectRefId: typeof record.objectRefId === "string" ? record.objectRefId : undefined,
      path: record.path as string,
      storageKey: record.storageKey as string,
      expectedChecksum: typeof record.expectedChecksum === "string" ? record.expectedChecksum : null,
      expectedSize: typeof record.expectedSize === "number" ? record.expectedSize : null,
      resourceType: record.resourceType as string,
      resourceId: record.resourceId as string,
    };
  });
}

function packageModeFromMetadata(metadata: Record<string, unknown>): ApiExportPackageMode {
  return metadata.packageMode === "manifest_only" ? "manifest_only" : "zip";
}

function packageWriterForMode(mode: ApiExportPackageMode) {
  return mode === "manifest_only" ? EXPORT_JOB_MANIFEST_WRITER : EXPORT_JOB_PACKAGE_WRITER;
}

function exportJobConfig() {
  return getRuntimeConfig().exportJobs;
}

function sanitizeExportBatch(batch: {
  id: string;
  projectId: string;
  target: ExportTarget;
  status: string;
  manifestChecksum: string | null;
  manifestFormatVersion?: string;
  packageChecksum?: string | null;
  selectionCriteria: Prisma.JsonValue | null;
  warnings: Prisma.JsonValue | null;
  metadataSummary: Prisma.JsonValue | null;
  exportedAt: Date;
  createdAt: Date;
  jobAttemptCount?: number;
  jobMaxAttempts?: number;
  nextRetryAt?: Date | null;
  processorId?: string | null;
  processorRunId?: string | null;
  leaseExpiresAt?: Date | null;
  processingStartedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  _count?: { items: number };
}) {
  const metadata = metadataRecord(batch.metadataSummary);
  const warningList = Array.isArray(batch.warnings) ? batch.warnings : [];
  const packageChecksum =
    batch.packageChecksum ?? (typeof metadata.packageChecksum === "string" ? metadata.packageChecksum : null);
  const packageMode = packageModeFromMetadata(metadata);
  const packageAvailable = batch.status === "COMPLETED" && Boolean(packageChecksum);
  const manifestAvailable = batch.status === "COMPLETED" && Boolean(batch.manifestChecksum);

  return {
    id: batch.id,
    projectId: batch.projectId,
    target: batch.target,
    status: batch.status,
    manifestChecksum: batch.manifestChecksum,
    manifestFormatVersion: batch.manifestFormatVersion ?? null,
    packageChecksum,
    packageMode,
    logicalTarget: typeof metadata.logicalTarget === "string" ? metadata.logicalTarget : null,
    manifestAvailable,
    packageAvailable,
    itemCount: batch._count?.items ?? (typeof metadata.itemCount === "number" ? metadata.itemCount : 0),
    warningCount: warningList.length,
    selection: batch.selectionCriteria,
    exportedAt: batch.exportedAt,
    createdAt: batch.createdAt,
    completedAt: batch.completedAt ?? null,
    failedAt: batch.failedAt ?? null,
    errorCode: batch.errorCode ?? null,
    errorMessage: batch.errorMessage ?? null,
    job: {
      attemptCount: batch.jobAttemptCount ?? 0,
      maxAttempts: batch.jobMaxAttempts ?? 0,
      nextRetryAt: batch.nextRetryAt ?? null,
      processorId: batch.processorId ?? null,
      processorRunId: batch.processorRunId ?? null,
      leaseExpiresAt: batch.leaseExpiresAt ?? null,
      processingStartedAt: batch.processingStartedAt ?? null,
    },
    downloads:
      batch.status === "COMPLETED"
        ? {
            manifest: `/api/exports/${batch.id}/download?file=manifest`,
            package: packageAvailable ? `/api/exports/${batch.id}/download?file=package` : null,
          }
        : null,
  };
}

function trainingExportItemsFromManifest(
  manifest: Awaited<ReturnType<typeof buildManifest>>,
) {
  return manifest.items.flatMap((item) => {
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
}

function cropTrainingExportItemsFromManifest(
  manifest: Awaited<ReturnType<typeof buildCropTrainingManifest>>,
) {
  return manifest.cropItems.flatMap((item) => {
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
    if (item.supportMask) {
      rows.splice(2, 0, {
        role: "crop-support-mask",
        imageId: item.originalImage.id,
        artifactVersionId: item.supportMask.artifactVersionId,
        derivedCropId: item.derivedCrop.id,
      });
    }
    return rows;
  });
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
      latestSemanticMaskVersionId: candidate.latestSemanticMask?.id ?? null,
      latestSupportMaskVersionId: candidate.latestSupportMask?.id ?? null,
      latestClassificationVersionId: candidate.latestClassification?.id ?? null,
      eligibleTargets: candidate.eligibleTargets,
      warnings: candidate.warnings,
    })),
    cropCandidates: readiness.cropCandidates.map(sanitizeCropWorkflowCandidate),
  };
}

async function createCropTrainingExportBatch(params: {
  readiness: Awaited<ReturnType<typeof resolveProjectExportReadiness>>;
  user: { id: string; email: string; name: string | null };
  packageMode: ApiExportPackageMode;
}, db: PrismaClient) {
  const exportId = randomUUID();
  const exportedAt = new Date();
  const selectionCriteria = {
    targets: ["crop_training"],
    approvedOnly: true,
    approvedSnapshotFreshnessPolicy: APPROVED_SNAPSHOT_FRESHNESS_POLICY,
    cropCoordinateSpace: "CROP_PIXEL",
    originalCoordinateMasks: false,
  };
  if (hasBlockingCropFreshnessReasons(params.readiness.cropCandidates)) {
    throw new TrainingExportError("EXPORT_APPROVED_SNAPSHOT_OUTDATED");
  }

  const manifest = await buildCropTrainingManifest({
    db,
    exportId,
    exportedAt,
    exportedBy: params.user,
    project: { id: params.readiness.project.id, name: params.readiness.project.name },
    candidates: params.readiness.cropCandidates,
  });
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  assertCropTrainingExportCaps({
    manifest,
    candidates: params.readiness.cropCandidates,
    manifestBytes,
  });
  const packageSources = buildCropTrainingPackageSources({
    manifest,
    candidates: params.readiness.cropCandidates,
  });
  const exportItems = cropTrainingExportItemsFromManifest(manifest);

  const queued = await db.$transaction(async (tx) => {
    const created = await tx.exportBatch.create({
      data: {
        id: exportId,
        projectId: params.readiness.project.id,
        target: ExportTarget.CROP_TRAINING,
        status: ExportStatus.PENDING,
        manifestFormatVersion: CROP_TRAINING_EXPORT_MANIFEST_VERSION,
        selectionCriteria,
        warnings: manifest.warnings,
        metadataSummary: {
          packageMode: params.packageMode,
          packageWriter: packageWriterForMode(params.packageMode),
          manifestSnapshot: manifest,
          packageSources,
          objectSources: packageSources,
          itemCount: manifest.summary.cropItemCount,
          cropItemCount: manifest.summary.cropItemCount,
          skippedCropItemCount: manifest.summary.skippedCropItemCount,
          warningCount: manifest.summary.warningCount,
          estimatedBytes: estimateSourceBytes({ manifestBytes, sources: packageSources }),
        },
        exportedById: params.user.id,
        exportedAt,
        jobMaxAttempts: exportJobConfig().maxAttempts,
        ...(exportItems.length
          ? { items: { createMany: { data: exportItems } } }
          : {}),
      },
      select: EXPORT_BATCH_SANITIZE_SELECT,
    });

    await recordAuditEvent({
      action: "EXPORT_QUEUED",
      entity: "ExportBatch",
      entityId: created.id,
      actorId: params.user.id,
      details: {
        projectId: created.projectId,
        target: created.target,
        manifestFormatVersion: CROP_TRAINING_EXPORT_MANIFEST_VERSION,
        packageMode: params.packageMode,
        itemCount: manifest.summary.cropItemCount,
      },
    }, tx);

    return created;
  });

  return sanitizeExportBatch(queued);
}

async function createSapenCnnTrainingExportBatch(params: {
  readiness: Awaited<ReturnType<typeof resolveProjectExportReadiness>>;
  user: { id: string; email: string; name: string | null };
}, db: PrismaClient) {
  const exportId = randomUUID();
  const exportedAt = new Date();
  const selectionCriteria = {
    targets: [SAPEN_CNN_TRAINING_TARGET],
    approvedOnly: true,
    approvedSnapshotFreshnessPolicy: APPROVED_SNAPSHOT_FRESHNESS_POLICY,
    packageMode: "manifest_only",
  };
  if (hasBlockingCropFreshnessReasons(params.readiness.cropCandidates)) {
    throw new TrainingExportError("EXPORT_APPROVED_SNAPSHOT_OUTDATED");
  }

  const snapshot = await buildSapenCnnTrainingSnapshot({
    db,
    exportId,
    exportedAt,
    exportedBy: params.user,
    project: { id: params.readiness.project.id, name: params.readiness.project.name },
    candidates: params.readiness.cropCandidates,
  });
  const manifestBytes = new TextEncoder().encode(JSON.stringify(snapshot.manifest, null, 2));
  assertExportWithinTrialCaps({
    metrics: {
      itemCount: snapshot.manifest.summary.itemCount,
      estimatedBytes: estimateSourceBytes({
        manifestBytes,
        sources: snapshot.objectSources,
      }),
    },
    limits: trainingExportTrialLimits(),
    itemCode: "EXPORT_ITEM_LIMIT_EXCEEDED",
    byteCode: "EXPORT_BYTE_LIMIT_EXCEEDED",
  });
  const exportItems = sapenCnnTrainingExportItemsFromManifest({ manifest: snapshot.manifest });

  const queued = await db.$transaction(async (tx) => {
    const created = await tx.exportBatch.create({
      data: {
        id: exportId,
        projectId: params.readiness.project.id,
        target: ExportTarget.COMBINED_MANIFEST,
        status: ExportStatus.PENDING,
        manifestFormatVersion: SAPEN_CNN_TRAINING_MANIFEST_VERSION,
        selectionCriteria,
        warnings: snapshot.manifest.warnings as Prisma.InputJsonValue,
        metadataSummary: {
          logicalTarget: SAPEN_CNN_TRAINING_TARGET,
          packageMode: "manifest_only",
          packageWriter: packageWriterForMode("manifest_only"),
          manifestSnapshot: snapshot.manifest,
          packageSources: snapshot.objectSources,
          objectSources: snapshot.objectSources,
          itemCount: snapshot.manifest.summary.itemCount,
          fullImageItemCount: snapshot.manifest.summary.fullImageItemCount,
          classificationItemCount: snapshot.manifest.summary.classificationItemCount,
          cropSemanticItemCount: snapshot.manifest.summary.cropSemanticItemCount,
          skippedItemCount: snapshot.manifest.summary.skippedItemCount,
          warningCount: snapshot.manifest.summary.warningCount,
          estimatedBytes: estimateSourceBytes({ manifestBytes, sources: snapshot.objectSources }),
        } as Prisma.InputJsonObject,
        exportedById: params.user.id,
        exportedAt,
        jobMaxAttempts: exportJobConfig().maxAttempts,
        ...(exportItems.length
          ? { items: { createMany: { data: exportItems } } }
          : {}),
      },
      select: EXPORT_BATCH_SANITIZE_SELECT,
    });

    await recordAuditEvent({
      action: "EXPORT_QUEUED",
      entity: "ExportBatch",
      entityId: created.id,
      actorId: params.user.id,
      details: {
        projectId: created.projectId,
        target: created.target,
        logicalTarget: SAPEN_CNN_TRAINING_TARGET,
        manifestFormatVersion: SAPEN_CNN_TRAINING_MANIFEST_VERSION,
        packageMode: "manifest_only",
        itemCount: snapshot.manifest.summary.itemCount,
      },
    }, tx);

    return created;
  });

  return sanitizeExportBatch(queued);
}

export async function createTrainingExportForUser(params: {
  projectId: string;
  userId: string;
  targets: ApiExportTarget[];
  packageMode?: ApiExportPackageMode;
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
  const packageMode = params.packageMode ?? (isSapenCnnTrainingSelection(params.targets) ? "manifest_only" : "zip");

  if (isCropTrainingSelection(params.targets)) {
    return createCropTrainingExportBatch({ readiness, user, packageMode }, db);
  }
  if (isSapenCnnTrainingSelection(params.targets)) {
    if (packageMode !== "manifest_only") throw new TrainingExportError("EXPORT_PACKAGE_MODE_INVALID");
    return createSapenCnnTrainingExportBatch({ readiness, user }, db);
  }

  const selectionCriteria = {
    targets: params.targets,
    approvedOnly: true,
    approvedSnapshotFreshnessPolicy: APPROVED_SNAPSHOT_FRESHNESS_POLICY,
  };

  const exportId = randomUUID();
  const exportedAt = new Date();
  const manifest = await buildManifest({
    db,
    exportId,
    exportedAt,
    exportedBy: user,
    project: { id: readiness.project.id, name: readiness.project.name },
    targets: params.targets,
    candidates: readiness.candidates,
  });
  if (hasBlockingIntegrityWarnings(manifest)) {
    throw new TrainingExportError("EXPORT_INTEGRITY_METADATA_MISSING");
  }
  if (hasBlockingFreshnessWarnings(manifest)) {
    throw new TrainingExportError("EXPORT_APPROVED_SNAPSHOT_OUTDATED");
  }
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  assertTrainingExportCaps({
    manifest,
    candidates: readiness.candidates,
    manifestBytes,
  });
  const packageSources = buildTrainingPackageSources({
    manifest,
    candidates: readiness.candidates,
  });
  const exportItems = trainingExportItemsFromManifest(manifest);

  const queued = await db.$transaction(async (tx) => {
    const created = await tx.exportBatch.create({
      data: {
        id: exportId,
        projectId: readiness.project.id,
        target: targetForSelection(params.targets),
        status: ExportStatus.PENDING,
        manifestFormatVersion: TRAINING_EXPORT_MANIFEST_VERSION,
        selectionCriteria,
        warnings: manifest.warnings,
        metadataSummary: {
          packageMode,
          packageWriter: packageWriterForMode(packageMode),
          manifestSnapshot: manifest,
          packageSources,
          objectSources: packageSources,
          itemCount: manifest.summary.itemCount,
          skippedImageCount: manifest.summary.skippedImageCount,
          warningCount: manifest.summary.warningCount,
          estimatedBytes: estimateSourceBytes({ manifestBytes, sources: packageSources }),
        },
        exportedById: user.id,
        exportedAt,
        jobMaxAttempts: exportJobConfig().maxAttempts,
        ...(exportItems.length
          ? { items: { createMany: { data: exportItems } } }
          : {}),
      },
      select: EXPORT_BATCH_SANITIZE_SELECT,
    });

    await recordAuditEvent({
      action: "EXPORT_QUEUED",
      entity: "ExportBatch",
      entityId: created.id,
      actorId: user.id,
      details: {
        projectId: created.projectId,
        target: created.target,
        packageMode,
        itemCount: manifest.summary.itemCount,
      },
    }, tx);

    return created;
  });

  return sanitizeExportBatch(queued);
}

export async function processClaimedTrainingExportJob(params: {
  exportId: string;
  userId: string;
}, db: PrismaClient = prisma) {
  const batch = await db.exportBatch.findUnique({
    where: { id: params.exportId },
    select: {
      id: true,
      projectId: true,
      target: true,
      status: true,
      metadataSummary: true,
      manifestFormatVersion: true,
      exportedById: true,
    },
  });
  if (!batch) throw new TrainingExportError("EXPORT_NOT_FOUND");
  if (batch.target === ExportTarget.PREDICTION_ANALYSIS) throw new TrainingExportError("EXPORT_NOT_FOUND");
  if (batch.status !== ExportStatus.PROCESSING) throw new TrainingExportError("EXPORT_JOB_NOT_PROCESSING");

  const metadata = metadataRecord(batch.metadataSummary);
  const manifest = readManifestSnapshot(metadata);
  const sources = readPackageSources(metadata);
  const packageMode = packageModeFromMetadata(metadata);
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  const summary = metadataRecord((manifest as Record<string, unknown>).summary as Prisma.JsonValue);
  const itemCount =
    typeof summary.itemCount === "number"
      ? summary.itemCount
      : typeof summary.cropItemCount === "number"
        ? summary.cropItemCount
        : 0;

  assertExportWithinTrialCaps({
    metrics: {
      itemCount,
      estimatedBytes: estimateSourceBytes({ manifestBytes, sources }),
    },
    limits: trainingExportTrialLimits(),
    itemCode: "EXPORT_ITEM_LIMIT_EXCEEDED",
    byteCode: "EXPORT_BYTE_LIMIT_EXCEEDED",
  });

  const exportPrefix = `projects/${batch.projectId}/exports/${batch.id}`;
  let writeResult:
    | ({ packageMode: "zip" } & Awaited<ReturnType<typeof writeExportPackageObjects>>)
    | ({ packageMode: "manifest_only" } & ExportManifestWriteResult);

  if (packageMode === "manifest_only") {
    await verifyExportPackageSources(sources);
    writeResult = {
      packageMode,
      ...(await writeExportManifestObject({
        manifest,
        manifestStorageKey: `${exportPrefix}/manifest.json`,
      })),
    };
  } else {
    writeResult = {
      packageMode,
      ...(await writeExportPackageObjects({
        manifest,
        sources,
        manifestStorageKey: `${exportPrefix}/manifest.json`,
        packageStorageKey: `${exportPrefix}/package.zip`,
      })),
    };
  }

  let completed: Prisma.ExportBatchGetPayload<{ select: typeof EXPORT_BATCH_SANITIZE_SELECT }>;
  try {
    completed = await db.$transaction(async (tx) => {
      const updated = await tx.exportBatch.update({
        where: { id: batch.id },
        data: {
          status: ExportStatus.COMPLETED,
          manifestStorageKey: writeResult.manifestStorageKey,
          manifestChecksum: writeResult.manifestChecksum,
          packageStorageKey: writeResult.packageMode === "zip" ? writeResult.packageStorageKey : null,
          packageChecksum: writeResult.packageMode === "zip" ? writeResult.packageChecksum : null,
          packageSize: writeResult.packageMode === "zip" ? writeResult.packageSize : null,
          warnings: Array.isArray((manifest as Record<string, unknown>).warnings)
            ? (manifest as Record<string, unknown>).warnings as Prisma.InputJsonValue
            : [],
          metadataSummary: {
            ...metadata,
            packageMode,
            manifestStorageKey: writeResult.manifestStorageKey,
            manifestChecksum: writeResult.manifestChecksum,
            packageStorageKey: writeResult.packageMode === "zip" ? writeResult.packageStorageKey : null,
            packageChecksum: writeResult.packageMode === "zip" ? writeResult.packageChecksum : null,
            packageSize: writeResult.packageMode === "zip" ? writeResult.packageSize : null,
          },
          completedAt: new Date(),
          failedAt: null,
          errorCode: null,
          errorMessage: null,
          nextRetryAt: null,
          processorId: null,
          processorRunId: null,
          leaseExpiresAt: null,
        },
        select: EXPORT_BATCH_SANITIZE_SELECT,
      });

      await recordAuditEvent({
        action: "EXPORT_CREATED",
        entity: "ExportBatch",
        entityId: updated.id,
        actorId: params.userId,
        details: {
          projectId: updated.projectId,
          target: updated.target,
          manifestChecksum: updated.manifestChecksum,
          packageChecksum: updated.packageChecksum,
          manifestFormatVersion: batch.manifestFormatVersion,
          packageMode,
        },
      }, tx);

      return updated;
    });
  } catch (error) {
    if (writeResult.packageMode === "zip") {
      await deleteExportPackageObjectsBestEffort(writeResult);
    } else {
      await deleteExportManifestObjectBestEffort(writeResult);
    }
    throw error;
  }

  return sanitizeExportBatch(completed);
}

async function loadExportForUser(params: {
  exportId: string;
  userId: string;
}, db: ExportDb = prisma) {
  const batch = await db.exportBatch.findUnique({
    where: { id: params.exportId },
    select: {
      ...EXPORT_BATCH_SANITIZE_SELECT,
      manifestStorageKey: true,
      packageStorageKey: true,
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
  if (batch.status === "FAILED") throw new TrainingExportError("EXPORT_FAILED");
  if (batch.status !== "COMPLETED") throw new TrainingExportError("EXPORT_NOT_READY");

  const metadata = metadataRecord(batch.metadataSummary);
  const key =
    params.file === "manifest"
      ? batch.manifestStorageKey
      : batch.packageStorageKey ?? (typeof metadata.packageStorageKey === "string" ? metadata.packageStorageKey : null);
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

export async function getTrainingExportMaterializationRefsForUser(params: {
  exportId: string;
  userId: string;
}, db: ExportDb = prisma) {
  const batch = await loadExportForUser(params, db);
  if (batch.status === "FAILED") throw new TrainingExportError("EXPORT_FAILED");
  if (batch.status !== "COMPLETED") throw new TrainingExportError("EXPORT_NOT_READY");

  const metadata = metadataRecord(batch.metadataSummary);
  const sources = readPackageSources(metadata);
  const packageMode = packageModeFromMetadata(metadata);
  const logicalTarget = typeof metadata.logicalTarget === "string" ? metadata.logicalTarget : null;

  await recordAuditEvent({
    action: "EXPORT_MATERIALIZATION_REFS_ACCESSED",
    entity: "ExportBatch",
    entityId: batch.id,
    actorId: params.userId,
    details: {
      projectId: batch.projectId,
      manifestFormatVersion: batch.manifestFormatVersion,
      logicalTarget,
      packageMode,
      refCount: sources.length,
    },
  }, db);

  return {
    exportId: batch.id,
    projectId: batch.projectId,
    manifestFormatVersion: batch.manifestFormatVersion,
    logicalTarget,
    packageMode,
    refs: sources.map((source) => ({
      objectRefId: source.objectRefId ?? source.path,
      path: source.path,
      role: source.resourceType,
      resourceType: source.resourceType,
      resourceId: source.resourceId,
      storageKey: source.storageKey,
      expectedChecksum: source.expectedChecksum ?? null,
      expectedSize: source.expectedSize ?? null,
    })),
  };
}

export function exportErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof ExportObjectIntegrityError) {
    return { error: error.code, status: error.status };
  }
  if (error instanceof ExportTrialCapError) {
    return { error: error.code, status: error.status };
  }
  if (error instanceof TrainingExportError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code.endsWith("_NOT_FOUND") || error.code === "PROJECT_NOT_FOUND"
          ? 404
          : error.code === "EXPORT_NOT_READY"
            ? 409
            : error.code === "EXPORT_FAILED"
              ? 409
            : 400;
    return { error: error.code, status };
  }

  return { error: "TRAINING_EXPORT_FAILED", status: 500 };
}
