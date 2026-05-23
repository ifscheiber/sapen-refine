import {
  AnnotationArtifactKind,
  ArtifactReviewState,
  SliceClassificationSource,
  type AnnotationProjectRole,
  type Prisma,
  PrismaClient,
} from "@prisma/client";

import { prisma } from "@/server/db";
import { canReview, canSubmitReview } from "@/server/domain/review";
import { normalizeChecksum } from "@/server/uploads/integrity";

type CropReadinessDb = PrismaClient | Prisma.TransactionClient;

export type CropWorkflowReadinessStatus = "READY" | "PARTIAL" | "NOT_READY" | "REVIEW_REQUIRED";

export type CropWorkflowNextAction =
  | "OPEN_SUPPORT_EDITOR"
  | "OPEN_SEMANTIC_EDITOR"
  | "REVIEW_SUPPORT_MASK"
  | "REVIEW_SEMANTIC_MASK"
  | "REVIEW_CLASSIFICATION"
  | "REGENERATE_CROP_OR_REVIEW_LINEAGE";

type ReviewApproval = {
  decisionId: string;
  approvedBy: {
    id: string;
    email: string;
    name: string | null;
  };
  approvedAt: Date;
};

type CropReviewActions = {
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
};

const CROP_ARTIFACT_SELECT = {
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
  artifact: {
    select: {
      imageId: true,
      projectId: true,
      kind: true,
      scopeKey: true,
    },
  },
} satisfies Prisma.AnnotationArtifactVersionSelect;

const CROP_CLASSIFICATION_SELECT = {
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

type CropRecord = Prisma.DerivedSliceCropGetPayload<{ select: typeof CROP_SELECT }>;
export type CropArtifactVersion = Prisma.AnnotationArtifactVersionGetPayload<{
  select: typeof CROP_ARTIFACT_SELECT;
}> & { approval: ReviewApproval | null };
export type CropClassificationVersion = Prisma.SliceClassificationVersionGetPayload<{
  select: typeof CROP_CLASSIFICATION_SELECT;
}> & { approval: ReviewApproval | null };

export type CropWorkflowCandidate = {
  crop: CropRecord;
  supportMask: CropArtifactVersion | null;
  semanticMask: CropArtifactVersion | null;
  classification: CropClassificationVersion | null;
  latestSupportMask: CropArtifactVersion | null;
  latestSemanticMask: CropArtifactVersion | null;
  latestClassification: CropClassificationVersion | null;
  readinessStatus: CropWorkflowReadinessStatus;
  readinessReasons: string[];
  nextActions: CropWorkflowNextAction[];
  reviewActions: {
    supportMask: CropReviewActions | null;
    semanticMask: CropReviewActions | null;
    classification: CropReviewActions | null;
  };
};

export class CropReadinessWorkflowError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

function hasValidChecksum(value: string | null | undefined) {
  return Boolean(normalizeChecksum(value));
}

function hasValidDimensions(value: { width: number | null; height: number | null }) {
  return Number.isInteger(value.width) && Number.isInteger(value.height) && value.width! > 0 && value.height! > 0;
}

function hasPositiveInteger(value: number | null | undefined) {
  return Number.isInteger(value) && value! > 0;
}

function hasValidArtifactIntegrity(value: CropArtifactVersion) {
  return hasValidChecksum(value.checksum) && hasValidDimensions(value);
}

function hasValidCropIntegrity(value: CropRecord) {
  return (
    hasValidChecksum(value.checksum) &&
    hasPositiveInteger(value.cropWidth) &&
    hasPositiveInteger(value.cropHeight) &&
    hasPositiveInteger(value.byteSize)
  );
}

function cropVersionLineageMatches(version: CropArtifactVersion, crop: CropRecord) {
  return (
    version.derivedCropId === crop.id &&
    version.sliceInstanceId === crop.sliceInstanceId &&
    version.artifact.imageId === crop.sourceImageId &&
    version.artifact.projectId === crop.projectId
  );
}

function cropVersionCoordinateMatches(version: CropArtifactVersion, crop: CropRecord) {
  return (
    version.coordinateSpace === "CROP_PIXEL" &&
    version.width === crop.cropWidth &&
    version.height === crop.cropHeight
  );
}

function cropSourceLineageMatches(crop: CropRecord) {
  const cropChecksum = normalizeChecksum(crop.sourceImageChecksum);
  const sourceChecksum = normalizeChecksum(crop.sourceImage.checksum);
  const checksumMatchesWhenPresent = !cropChecksum || !sourceChecksum || cropChecksum === sourceChecksum;

  return (
    crop.sourceImageId === crop.sourceImage.id &&
    crop.sourceImageWidth === crop.sourceImage.width &&
    crop.sourceImageHeight === crop.sourceImage.height &&
    checksumMatchesWhenPresent
  );
}

function hasDerivedClassificationRefs(classification: CropClassificationVersion) {
  return Boolean(
    classification.derivedFromCropId ||
      classification.derivedFromSemanticMaskVersionId ||
      classification.derivedFromSupportMaskVersionId,
  );
}

function addClassificationLineageReasons(params: {
  reasons: Set<string>;
  crop: CropRecord;
  supportApproved: CropArtifactVersion | null;
  semanticApproved: CropArtifactVersion | null;
  classificationApproved: CropClassificationVersion;
}) {
  const { reasons, crop, supportApproved, semanticApproved, classificationApproved } = params;

  if (
    classificationApproved.projectId !== crop.projectId ||
    classificationApproved.imageId !== crop.sourceImageId ||
    classificationApproved.sliceInstanceId !== crop.sliceInstanceId
  ) {
    reasons.add("LINEAGE_MISMATCH");
    return;
  }

  if (classificationApproved.source === SliceClassificationSource.AUTO_FROM_SEMANTIC_MASK) {
    if (classificationApproved.derivedFromCropId !== crop.id) {
      reasons.add("LINEAGE_MISMATCH");
    }
    if (semanticApproved && classificationApproved.derivedFromSemanticMaskVersionId !== semanticApproved.id) {
      reasons.add("CLASSIFICATION_SEMANTIC_MISMATCH");
    }
    if (supportApproved && classificationApproved.derivedFromSupportMaskVersionId !== supportApproved.id) {
      reasons.add("CLASSIFICATION_SEMANTIC_MISMATCH");
    }
    return;
  }

  if (classificationApproved.source !== SliceClassificationSource.MANUAL) return;

  if (hasDerivedClassificationRefs(classificationApproved)) {
    if (classificationApproved.derivedFromCropId && classificationApproved.derivedFromCropId !== crop.id) {
      reasons.add("LINEAGE_MISMATCH");
    }
    if (
      semanticApproved &&
      classificationApproved.derivedFromSemanticMaskVersionId &&
      classificationApproved.derivedFromSemanticMaskVersionId !== semanticApproved.id
    ) {
      reasons.add("CLASSIFICATION_SEMANTIC_MISMATCH");
    }
    if (
      supportApproved &&
      classificationApproved.derivedFromSupportMaskVersionId &&
      classificationApproved.derivedFromSupportMaskVersionId !== supportApproved.id
    ) {
      reasons.add("CLASSIFICATION_SEMANTIC_MISMATCH");
    }
  }

  if (
    supportApproved &&
    semanticApproved &&
    (classificationApproved.createdAt.getTime() < supportApproved.createdAt.getTime() ||
      classificationApproved.createdAt.getTime() < semanticApproved.createdAt.getTime())
  ) {
    reasons.add("CLASSIFICATION_STALE");
  }
}

function readinessStatus(reasons: Set<string>, hasAnyCropWork: boolean): CropWorkflowReadinessStatus {
  if (reasons.size === 0) return "READY";
  const reasonList = Array.from(reasons);
  if (
    reasonList.some((reason) =>
      [
        "LINEAGE_MISMATCH",
        "SUPPORT_SEMANTIC_MISMATCH",
        "CLASSIFICATION_SEMANTIC_MISMATCH",
        "COORDINATE_SPACE_MISMATCH",
        "CROP_NOT_CURRENT",
        "CLASSIFICATION_STALE",
      ].includes(reason),
    )
  ) {
    return "REVIEW_REQUIRED";
  }
  return hasAnyCropWork ? "PARTIAL" : "NOT_READY";
}

function nextActions(params: {
  reasons: string[];
  supportAny: CropArtifactVersion | null;
  semanticAny: CropArtifactVersion | null;
  classificationAny: CropClassificationVersion | null;
}) {
  const actions = new Set<CropWorkflowNextAction>();
  const reasons = new Set(params.reasons);

  if (reasons.has("MISSING_SUPPORT_MASK")) actions.add("OPEN_SUPPORT_EDITOR");
  if (reasons.has("MISSING_SEMANTIC_MASK")) actions.add("OPEN_SEMANTIC_EDITOR");
  if (reasons.has("SUPPORT_NOT_APPROVED") && params.supportAny) actions.add("REVIEW_SUPPORT_MASK");
  if (reasons.has("SEMANTIC_NOT_APPROVED") && params.semanticAny) actions.add("REVIEW_SEMANTIC_MASK");
  if (
    (reasons.has("CLASSIFICATION_NOT_APPROVED") || reasons.has("AUTO_CLASSIFICATION_NEEDS_REVIEW")) &&
    params.classificationAny
  ) {
    actions.add("REVIEW_CLASSIFICATION");
  }
  if (
    ["LINEAGE_MISMATCH", "SUPPORT_SEMANTIC_MISMATCH", "CLASSIFICATION_SEMANTIC_MISMATCH", "COORDINATE_SPACE_MISMATCH", "CLASSIFICATION_STALE"].some((reason) =>
      reasons.has(reason),
    )
  ) {
    actions.add("REGENERATE_CROP_OR_REVIEW_LINEAGE");
  }

  return Array.from(actions);
}

export function cropReviewActionsForVersion(
  version: { reviewState: ArtifactReviewState | string } | null,
  role?: AnnotationProjectRole | null,
): CropReviewActions {
  return {
    canSubmit: Boolean(version && role && version.reviewState === ArtifactReviewState.DRAFT && canSubmitReview(role)),
    canApprove: Boolean(version && role && version.reviewState === ArtifactReviewState.SUBMITTED && canReview(role)),
    canReject: Boolean(version && role && version.reviewState === ArtifactReviewState.SUBMITTED && canReview(role)),
  };
}

export function evaluateCropWorkflowReadiness(params: {
  crop: CropRecord;
  supportAny: CropArtifactVersion | null;
  supportApproved: CropArtifactVersion | null;
  semanticAny: CropArtifactVersion | null;
  semanticApproved: CropArtifactVersion | null;
  classificationAny: CropClassificationVersion | null;
  classificationApproved: CropClassificationVersion | null;
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
  if (!cropSourceLineageMatches(crop)) reasons.add("LINEAGE_MISMATCH");

  if (!supportApproved) reasons.add(supportAny ? "SUPPORT_NOT_APPROVED" : "MISSING_SUPPORT_MASK");
  if (!semanticApproved) reasons.add(semanticAny ? "SEMANTIC_NOT_APPROVED" : "MISSING_SEMANTIC_MASK");
  if (!classificationApproved) {
    if (classificationAny?.source === SliceClassificationSource.AUTO_FROM_SEMANTIC_MASK) {
      reasons.add("AUTO_CLASSIFICATION_NEEDS_REVIEW");
    } else {
      reasons.add(classificationAny ? "CLASSIFICATION_NOT_APPROVED" : "MISSING_CLASSIFICATION");
    }
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
      reasons.add("SUPPORT_SEMANTIC_MISMATCH");
    }
  }

  if (classificationApproved) {
    addClassificationLineageReasons({
      reasons,
      crop,
      supportApproved,
      semanticApproved,
      classificationApproved,
    });
  }

  const hasAnyCropWork = Boolean(
    supportAny ||
      supportApproved ||
      semanticAny ||
      semanticApproved ||
      classificationAny ||
      classificationApproved,
  );
  const reasonList = Array.from(reasons).sort();
  return {
    status: readinessStatus(reasons, hasAnyCropWork),
    reasons: reasonList,
    nextActions: nextActions({ reasons: reasonList, supportAny, semanticAny, classificationAny }),
  };
}

async function loadApprovalForArtifactVersion(db: CropReadinessDb, artifactVersionId: string) {
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

async function loadApprovalForClassification(db: CropReadinessDb, sliceClassificationVersionId: string) {
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

async function loadLatestCropArtifactVersion(params: {
  db: CropReadinessDb;
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
    select: CROP_ARTIFACT_SELECT,
  });
  if (!version) return null;

  return {
    ...version,
    approval: await loadApprovalForArtifactVersion(params.db, version.id),
  };
}

async function loadLatestCropClassificationVersion(params: {
  db: CropReadinessDb;
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
    select: CROP_CLASSIFICATION_SELECT,
  });
  if (!version) return null;

  return {
    ...version,
    approval: await loadApprovalForClassification(params.db, version.id),
  };
}

function summarize(candidates: CropWorkflowCandidate[]) {
  const cropReasonCounts: Record<string, number> = {};
  for (const candidate of candidates) {
    for (const reason of candidate.readinessReasons) {
      cropReasonCounts[reason] = (cropReasonCounts[reason] ?? 0) + 1;
    }
  }

  return {
    totalCropItems: candidates.length,
    readyCropItems: candidates.filter((candidate) => candidate.readinessStatus === "READY").length,
    partialCropItems: candidates.filter((candidate) => candidate.readinessStatus === "PARTIAL").length,
    notReadyCropItems: candidates.filter((candidate) => candidate.readinessStatus === "NOT_READY").length,
    reviewRequiredCropItems: candidates.filter((candidate) => candidate.readinessStatus === "REVIEW_REQUIRED").length,
    cropItemsWithWarnings: candidates.filter((candidate) => candidate.readinessReasons.length > 0).length,
    cropReasonCounts,
  };
}

export async function resolveCropWorkflowReadiness(params: {
  projectId: string;
  imageId?: string;
  sliceInstanceId?: string;
  role?: AnnotationProjectRole | null;
}, db: CropReadinessDb = prisma) {
  const crops = await db.derivedSliceCrop.findMany({
    where: {
      projectId: params.projectId,
      ...(params.imageId ? { sourceImageId: params.imageId } : {}),
      ...(params.sliceInstanceId ? { sliceInstanceId: params.sliceInstanceId } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: CROP_SELECT,
  });

  const candidates: CropWorkflowCandidate[] = [];
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
        reviewState: ArtifactReviewState.APPROVED,
      }),
      loadLatestCropArtifactVersion({
        ...artifactParams,
        kind: AnnotationArtifactKind.SEMANTIC_MASK,
      }),
      loadLatestCropArtifactVersion({
        ...artifactParams,
        kind: AnnotationArtifactKind.SEMANTIC_MASK,
        reviewState: ArtifactReviewState.APPROVED,
      }),
      loadLatestCropClassificationVersion(classificationParams),
      loadLatestCropClassificationVersion({
        ...classificationParams,
        reviewState: ArtifactReviewState.APPROVED,
      }),
    ]);

    const readiness = evaluateCropWorkflowReadiness({
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
      latestSupportMask: supportAny,
      latestSemanticMask: semanticAny,
      latestClassification: classificationAny,
      readinessStatus: readiness.status,
      readinessReasons: readiness.reasons,
      nextActions: readiness.nextActions,
      reviewActions: {
        supportMask: supportAny ? cropReviewActionsForVersion(supportAny, params.role) : null,
        semanticMask: semanticAny ? cropReviewActionsForVersion(semanticAny, params.role) : null,
        classification: classificationAny ? cropReviewActionsForVersion(classificationAny, params.role) : null,
      },
    });
  }

  return {
    summary: summarize(candidates),
    candidates,
  };
}

export async function resolveCropWorkflowReadinessForUser(params: {
  projectId: string;
  userId: string;
  imageId?: string;
  sliceInstanceId?: string;
}, db: CropReadinessDb = prisma) {
  const project = await db.annotationProject.findUnique({
    where: { id: params.projectId },
    select: {
      id: true,
      name: true,
      labelSchemaVersion: { select: { id: true, name: true, version: true, status: true } },
      members: {
        where: { userId: params.userId },
        select: { role: true },
      },
    },
  });
  if (!project) throw new CropReadinessWorkflowError("PROJECT_NOT_FOUND");
  const membership = project.members[0];
  if (!membership) throw new CropReadinessWorkflowError("FORBIDDEN");

  const readiness = await resolveCropWorkflowReadiness(
    {
      projectId: project.id,
      imageId: params.imageId,
      sliceInstanceId: params.sliceInstanceId,
      role: membership.role,
    },
    db,
  );

  return {
    project: {
      id: project.id,
      name: project.name,
      labelSchemaVersion: project.labelSchemaVersion,
    },
    myRole: membership.role,
    permissions: {
      canSubmit: canSubmitReview(membership.role),
      canReview: canReview(membership.role),
    },
    ...readiness,
  };
}

function serializeUser(user: { id: string; email: string; name: string | null } | null) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

function sanitizeArtifactVersion(version: CropArtifactVersion | null) {
  if (!version) return null;
  return {
    id: version.id,
    version: version.version,
    contentType: version.contentType,
    size: version.size,
    checksum: version.checksum,
    width: version.width,
    height: version.height,
    format: version.format,
    coordinateSpace: version.coordinateSpace,
    coordinateTransform: version.coordinateTransform,
    labelSchemaVersionId: version.labelSchemaVersionId,
    reviewState: version.reviewState,
    derivedCropId: version.derivedCropId,
    sliceInstanceId: version.sliceInstanceId,
    supportMaskVersionId: version.supportMaskVersionId,
    cropSemanticMode: version.cropSemanticMode,
    createdAt: version.createdAt,
    createdBy: serializeUser(version.createdBy),
    artifact: version.artifact,
    approval: version.approval,
  };
}

function sanitizeClassification(version: CropClassificationVersion | null) {
  if (!version) return null;
  return {
    id: version.id,
    version: version.version,
    projectId: version.projectId,
    imageId: version.imageId,
    class: version.class,
    labelSchemaVersionId: version.labelSchemaVersionId,
    sliceInstanceId: version.sliceInstanceId,
    reviewState: version.reviewState,
    source: version.source,
    derivationReason: version.derivationReason,
    derivedFromSemanticMaskVersionId: version.derivedFromSemanticMaskVersionId,
    derivedFromSupportMaskVersionId: version.derivedFromSupportMaskVersionId,
    derivedFromCropId: version.derivedFromCropId,
    createdAt: version.createdAt,
    createdBy: serializeUser(version.createdBy),
    approval: version.approval,
  };
}

export function sanitizeCropWorkflowCandidate(candidate: CropWorkflowCandidate) {
  return {
    crop: {
      id: candidate.crop.id,
      projectId: candidate.crop.projectId,
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
      createdBy: serializeUser(candidate.crop.createdBy),
      assetUrl: `/api/slice-crops/${candidate.crop.id}/asset`,
    },
    sourceImage: {
      id: candidate.crop.sourceImage.id,
      filename: candidate.crop.sourceImage.filename,
      contentType: candidate.crop.sourceImage.contentType,
      size: candidate.crop.sourceImage.size,
      checksum: candidate.crop.sourceImage.checksum,
      width: candidate.crop.sourceImage.width,
      height: candidate.crop.sourceImage.height,
      uploadedAt: candidate.crop.sourceImage.uploadedAt,
    },
    supportMask: sanitizeArtifactVersion(candidate.supportMask),
    semanticMask: sanitizeArtifactVersion(candidate.semanticMask),
    classification: sanitizeClassification(candidate.classification),
    latestSupportMask: sanitizeArtifactVersion(candidate.latestSupportMask),
    latestSemanticMask: sanitizeArtifactVersion(candidate.latestSemanticMask),
    latestClassification: sanitizeClassification(candidate.latestClassification),
    supportMaskVersionId: candidate.supportMask?.id ?? null,
    semanticMaskVersionId: candidate.semanticMask?.id ?? null,
    classificationVersionId: candidate.classification?.id ?? null,
    latestSupportMaskVersionId: candidate.latestSupportMask?.id ?? null,
    latestSemanticMaskVersionId: candidate.latestSemanticMask?.id ?? null,
    latestClassificationVersionId: candidate.latestClassification?.id ?? null,
    readinessStatus: candidate.readinessStatus,
    readinessReasons: candidate.readinessReasons,
    nextActions: candidate.nextActions,
    reviewActions: candidate.reviewActions,
  };
}

export function sanitizeCropWorkflowReadiness(
  readiness: Awaited<ReturnType<typeof resolveCropWorkflowReadinessForUser>>,
) {
  return {
    ...readiness,
    candidates: readiness.candidates.map(sanitizeCropWorkflowCandidate),
  };
}

export function cropReadinessErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof CropReadinessWorkflowError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code.endsWith("_NOT_FOUND") || error.code === "PROJECT_NOT_FOUND"
          ? 404
          : error.code.endsWith("_MISMATCH")
            ? 409
            : 400;
    return { error: error.code, status };
  }

  return { error: "CROP_READINESS_FAILED", status: 500 };
}
