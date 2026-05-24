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
import {
  resolveCropWorkflowReadiness,
  sanitizeCropWorkflowCandidate,
  type CropWorkflowCandidate,
} from "@/server/domain/cropReadiness";
import {
  ExportObjectIntegrityError,
  getVerifiedExportObjectBytes,
} from "@/server/domain/exportObjectIntegrity";
import { getObjectBytes, putObject } from "@/server/storage/s3";
import { normalizeChecksum } from "@/server/uploads/integrity";

type ExportDb = PrismaClient | Prisma.TransactionClient;

export type ApiExportTarget =
  | "semantic_segmentation"
  | "support_segmentation"
  | "slice_classification"
  | "combined"
  | "crop_training";

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

    zip.file(item.image.path, await getVerifiedExportObjectBytes({
      storageKey: candidate.image.storageKey,
      expectedChecksum: candidate.image.checksum,
      expectedSize: candidate.image.size,
      resourceType: "ImageAsset",
      resourceId: candidate.image.id,
    }));
    if (item.semanticMask && candidate.semanticMask) {
      zip.file(item.semanticMask.path, await getVerifiedExportObjectBytes({
        storageKey: candidate.semanticMask.storageKey,
        expectedChecksum: candidate.semanticMask.checksum,
        expectedSize: candidate.semanticMask.size,
        resourceType: "AnnotationArtifactVersion",
        resourceId: candidate.semanticMask.id,
      }));
    }
    if (item.supportMask && candidate.supportMask) {
      zip.file(item.supportMask.path, await getVerifiedExportObjectBytes({
        storageKey: candidate.supportMask.storageKey,
        expectedChecksum: candidate.supportMask.checksum,
        expectedSize: candidate.supportMask.size,
        resourceType: "AnnotationArtifactVersion",
        resourceId: candidate.supportMask.id,
      }));
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
    if (!candidate?.semanticMask) continue;

    zip.file(item.originalImage.path, await getVerifiedExportObjectBytes({
      storageKey: candidate.crop.sourceImage.storageKey,
      expectedChecksum: candidate.crop.sourceImage.checksum,
      expectedSize: candidate.crop.sourceImage.size,
      resourceType: "ImageAsset",
      resourceId: candidate.crop.sourceImage.id,
    }));
    zip.file(item.derivedCrop.path, await getVerifiedExportObjectBytes({
      storageKey: candidate.crop.storageKey,
      expectedChecksum: candidate.crop.checksum,
      expectedSize: candidate.crop.byteSize,
      resourceType: "DerivedSliceCrop",
      resourceId: candidate.crop.id,
    }));
    if (item.supportMask && candidate.supportMask) {
      zip.file(item.supportMask.path, await getVerifiedExportObjectBytes({
        storageKey: candidate.supportMask.storageKey,
        expectedChecksum: candidate.supportMask.checksum,
        expectedSize: candidate.supportMask.size,
        resourceType: "AnnotationArtifactVersion",
        resourceId: candidate.supportMask.id,
      }));
    }
    zip.file(item.semanticMask.path, await getVerifiedExportObjectBytes({
      storageKey: candidate.semanticMask.storageKey,
      expectedChecksum: candidate.semanticMask.checksum,
      expectedSize: candidate.semanticMask.size,
      resourceType: "AnnotationArtifactVersion",
      resourceId: candidate.semanticMask.id,
    }));
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

function exportObjectIntegrityWarning(error: ExportObjectIntegrityError) {
  return {
    code: error.code,
    message: error.message,
    details: error.details,
  };
}

function exportFailureWarning(error: unknown) {
  if (error instanceof ExportObjectIntegrityError) return exportObjectIntegrityWarning(error);
  return {
    code: error instanceof TrainingExportError ? error.code : "EXPORT_GENERATION_FAILED",
    message: error instanceof Error ? error.message : "Unknown export failure",
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
    cropCandidates: readiness.cropCandidates.map(sanitizeCropWorkflowCandidate),
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
        warnings: [exportFailureWarning(error)],
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
        warnings: [exportFailureWarning(error)],
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
  if (error instanceof ExportObjectIntegrityError) {
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
            : 400;
    return { error: error.code, status };
  }

  return { error: "TRAINING_EXPORT_FAILED", status: 500 };
}
