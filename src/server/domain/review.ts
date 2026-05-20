import {
  AnnotationArtifactKind,
  AnnotationTaskStatus,
  AnnotationTaskType,
  ArtifactReviewState,
  ArtifactProvenance,
  type AnnotationProjectRole,
  type Prisma,
  PrismaClient,
} from "@prisma/client";

import { prisma } from "@/server/db";

type ReviewDb = PrismaClient | Prisma.TransactionClient;

export type ReviewAction = "submit" | "approve" | "reject";

const SUBMIT_ROLES = new Set<AnnotationProjectRole>(["OWNER", "QA", "LABELER"]);
const REVIEW_ROLES = new Set<AnnotationProjectRole>(["OWNER", "QA"]);
const REVIEWABLE_ARTIFACT_KINDS = new Set<AnnotationArtifactKind>([
  AnnotationArtifactKind.SEMANTIC_MASK,
  AnnotationArtifactKind.SLICE_SUPPORT_MASK,
]);

export class ReviewWorkflowError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

type VersionSummary = {
  id: string;
  version: number;
  reviewState: ArtifactReviewState;
  createdAt: Date;
  createdBy: { id: string; email: string; name: string | null } | null;
};

type ClassificationSummary = VersionSummary & {
  class: string;
};

type ReviewableSummary<TVersion extends VersionSummary = VersionSummary> = {
  type: "SEMANTIC_MASK" | "SLICE_SUPPORT_MASK" | "SLICE_CLASSIFICATION";
  label: string;
  latestVersion: TVersion | null;
  latestApprovedVersion: TVersion | null;
  exportReady: boolean;
  actions: {
    canSubmit: boolean;
    canApprove: boolean;
    canReject: boolean;
  };
};

const VERSION_SELECT = {
  id: true,
  version: true,
  reviewState: true,
  createdAt: true,
  createdBy: { select: { id: true, email: true, name: true } },
} satisfies Prisma.AnnotationArtifactVersionSelect;

const CLASSIFICATION_SELECT = {
  id: true,
  version: true,
  class: true,
  reviewState: true,
  createdAt: true,
  createdBy: { select: { id: true, email: true, name: true } },
} satisfies Prisma.SliceClassificationVersionSelect;

export function canSubmitReview(role: AnnotationProjectRole) {
  return SUBMIT_ROLES.has(role);
}

export function canReview(role: AnnotationProjectRole) {
  return REVIEW_ROLES.has(role);
}

export function isExportReadyState(state: ArtifactReviewState | null | undefined) {
  return state === ArtifactReviewState.APPROVED;
}

export function nextReviewStateForAction(params: {
  action: ReviewAction;
  currentState: ArtifactReviewState;
  comment?: string | null;
  reason?: string | null;
}) {
  if (params.action === "submit") {
    if (params.currentState !== ArtifactReviewState.DRAFT) {
      throw new ReviewWorkflowError("INVALID_REVIEW_TRANSITION");
    }
    return ArtifactReviewState.SUBMITTED;
  }

  if (params.action === "approve") {
    if (params.currentState !== ArtifactReviewState.SUBMITTED) {
      throw new ReviewWorkflowError("INVALID_REVIEW_TRANSITION");
    }
    return ArtifactReviewState.APPROVED;
  }

  if (params.action === "reject") {
    if (params.currentState !== ArtifactReviewState.SUBMITTED) {
      throw new ReviewWorkflowError("INVALID_REVIEW_TRANSITION");
    }
    if (!cleanText(params.reason) && !cleanText(params.comment)) {
      throw new ReviewWorkflowError("REJECT_REASON_REQUIRED");
    }
    return ArtifactReviewState.REJECTED;
  }

  throw new ReviewWorkflowError("INVALID_REVIEW_ACTION");
}

export function parseReviewAction(value: unknown): ReviewAction {
  if (value === "submit" || value === "approve" || value === "reject") return value;
  throw new ReviewWorkflowError("INVALID_REVIEW_ACTION");
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function assertPermission(role: AnnotationProjectRole, action: ReviewAction) {
  if (action === "submit" && !canSubmitReview(role)) {
    throw new ReviewWorkflowError("FORBIDDEN");
  }
  if ((action === "approve" || action === "reject") && !canReview(role)) {
    throw new ReviewWorkflowError("FORBIDDEN");
  }
}

function actionAvailability(
  version: VersionSummary | null,
  role: AnnotationProjectRole,
) {
  return {
    canSubmit: Boolean(version && version.reviewState === ArtifactReviewState.DRAFT && canSubmitReview(role)),
    canApprove: Boolean(version && version.reviewState === ArtifactReviewState.SUBMITTED && canReview(role)),
    canReject: Boolean(version && version.reviewState === ArtifactReviewState.SUBMITTED && canReview(role)),
  };
}

async function getImageAndMembership(db: ReviewDb, imageId: string, userId: string) {
  const image = await db.imageAsset.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true },
  });
  if (!image) throw new ReviewWorkflowError("IMAGE_NOT_FOUND");

  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId } },
    select: { role: true },
  });
  if (!membership) throw new ReviewWorkflowError("FORBIDDEN");

  return { image, membership };
}

async function loadArtifactReviewable(params: {
  db: ReviewDb;
  imageId: string;
  kind: AnnotationArtifactKind;
  role: AnnotationProjectRole;
}): Promise<ReviewableSummary> {
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

  const latestVersion = artifact
    ? await params.db.annotationArtifactVersion.findFirst({
        where: { artifactId: artifact.id },
        orderBy: { version: "desc" },
        select: VERSION_SELECT,
      })
    : null;
  const latestApprovedVersion = artifact
    ? await params.db.annotationArtifactVersion.findFirst({
        where: { artifactId: artifact.id, reviewState: ArtifactReviewState.APPROVED },
        orderBy: { version: "desc" },
        select: VERSION_SELECT,
      })
    : null;

  return {
    type:
      params.kind === AnnotationArtifactKind.SEMANTIC_MASK
        ? "SEMANTIC_MASK"
        : "SLICE_SUPPORT_MASK",
    label:
      params.kind === AnnotationArtifactKind.SEMANTIC_MASK
        ? "Semantic mask"
        : "Slice support mask",
    latestVersion,
    latestApprovedVersion,
    exportReady: isExportReadyState(latestApprovedVersion?.reviewState),
    actions: actionAvailability(latestVersion, params.role),
  };
}

async function loadClassificationReviewable(params: {
  db: ReviewDb;
  imageId: string;
  role: AnnotationProjectRole;
}): Promise<ReviewableSummary<ClassificationSummary>> {
  const latestVersion = await params.db.sliceClassificationVersion.findFirst({
    where: { imageId: params.imageId },
    orderBy: { version: "desc" },
    select: CLASSIFICATION_SELECT,
  });
  const latestApprovedVersion = await params.db.sliceClassificationVersion.findFirst({
    where: { imageId: params.imageId, reviewState: ArtifactReviewState.APPROVED },
    orderBy: { version: "desc" },
    select: CLASSIFICATION_SELECT,
  });

  return {
    type: "SLICE_CLASSIFICATION",
    label: "Slice classification",
    latestVersion,
    latestApprovedVersion,
    exportReady: isExportReadyState(latestApprovedVersion?.reviewState),
    actions: actionAvailability(latestVersion, params.role),
  };
}

export async function loadImageReviewStateForUser(params: {
  imageId: string;
  userId: string;
}, db: ReviewDb = prisma) {
  const { image, membership } = await getImageAndMembership(db, params.imageId, params.userId);
  const semanticMask = await loadArtifactReviewable({
    db,
    imageId: image.id,
    kind: AnnotationArtifactKind.SEMANTIC_MASK,
    role: membership.role,
  });
  const supportMask = await loadArtifactReviewable({
    db,
    imageId: image.id,
    kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
    role: membership.role,
  });
  const sliceClassification = await loadClassificationReviewable({
    db,
    imageId: image.id,
    role: membership.role,
  });

  const reviewables = { semanticMask, supportMask, sliceClassification };
  const warnings = Object.values(reviewables)
    .filter((reviewable) => !reviewable.exportReady)
    .map((reviewable) => `${reviewable.label} has no approved version`);

  return {
    image,
    myRole: membership.role,
    permissions: {
      canSubmit: canSubmitReview(membership.role),
      canReview: canReview(membership.role),
    },
    reviewables,
    exportReady: warnings.length === 0,
    warnings,
  };
}

export async function transitionArtifactVersionForUser(params: {
  versionId: string;
  userId: string;
  action: ReviewAction;
  comment?: string | null;
  reason?: string | null;
}, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const version = await tx.annotationArtifactVersion.findUnique({
      where: { id: params.versionId },
      select: {
        id: true,
        provenance: true,
        reviewState: true,
        taskId: true,
        artifact: { select: { id: true, imageId: true, projectId: true, kind: true } },
      },
    });
    if (!version) throw new ReviewWorkflowError("VERSION_NOT_FOUND");
    if (!REVIEWABLE_ARTIFACT_KINDS.has(version.artifact.kind)) {
      throw new ReviewWorkflowError("ARTIFACT_NOT_REVIEWABLE");
    }

    const membership = await tx.annotationProjectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: version.artifact.projectId,
          userId: params.userId,
        },
      },
      select: { role: true },
    });
    if (!membership) throw new ReviewWorkflowError("FORBIDDEN");
    assertPermission(membership.role, params.action);

    const comment = cleanText(params.comment);
    const reason = cleanText(params.reason);
    const nextState = nextReviewStateForAction({
      action: params.action,
      currentState: version.reviewState,
      comment,
      reason,
    });

    await tx.annotationArtifactVersion.update({
      where: { id: version.id },
      data: { reviewState: nextState },
    });

    if (version.taskId && version.provenance === ArtifactProvenance.HUMAN_CORRECTION) {
      const taskStatus =
        nextState === ArtifactReviewState.SUBMITTED
          ? AnnotationTaskStatus.SUBMITTED
          : nextState === ArtifactReviewState.APPROVED
            ? AnnotationTaskStatus.DONE
            : nextState === ArtifactReviewState.REJECTED
              ? AnnotationTaskStatus.IN_PROGRESS
              : null;

      if (taskStatus) {
        await tx.annotationTask.updateMany({
          where: {
            id: version.taskId,
            type: AnnotationTaskType.MODEL_PREDICTION_CORRECTION,
          },
          data: { status: taskStatus },
        });
      }
    }

    const decision = await tx.reviewDecision.create({
      data: {
        projectId: version.artifact.projectId,
        artifactVersionId: version.id,
        fromState: version.reviewState,
        toState: nextState,
        reviewedById: params.userId,
        comments: comment,
        reason,
      },
      select: { id: true, reviewedAt: true },
    });

    return {
      targetType: version.artifact.kind,
      versionId: version.id,
      imageId: version.artifact.imageId,
      projectId: version.artifact.projectId,
      fromState: version.reviewState,
      toState: nextState,
      decisionId: decision.id,
      reviewedAt: decision.reviewedAt,
    };
  });
}

export async function transitionSliceClassificationVersionForUser(params: {
  versionId: string;
  userId: string;
  action: ReviewAction;
  comment?: string | null;
  reason?: string | null;
}, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const version = await tx.sliceClassificationVersion.findUnique({
      where: { id: params.versionId },
      select: {
        id: true,
        imageId: true,
        projectId: true,
        reviewState: true,
      },
    });
    if (!version) throw new ReviewWorkflowError("VERSION_NOT_FOUND");

    const membership = await tx.annotationProjectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: version.projectId,
          userId: params.userId,
        },
      },
      select: { role: true },
    });
    if (!membership) throw new ReviewWorkflowError("FORBIDDEN");
    assertPermission(membership.role, params.action);

    const comment = cleanText(params.comment);
    const reason = cleanText(params.reason);
    const nextState = nextReviewStateForAction({
      action: params.action,
      currentState: version.reviewState,
      comment,
      reason,
    });

    await tx.sliceClassificationVersion.update({
      where: { id: version.id },
      data: { reviewState: nextState },
    });
    const decision = await tx.reviewDecision.create({
      data: {
        projectId: version.projectId,
        sliceClassificationVersionId: version.id,
        fromState: version.reviewState,
        toState: nextState,
        reviewedById: params.userId,
        comments: comment,
        reason,
      },
      select: { id: true, reviewedAt: true },
    });

    return {
      targetType: "SLICE_CLASSIFICATION" as const,
      versionId: version.id,
      imageId: version.imageId,
      projectId: version.projectId,
      fromState: version.reviewState,
      toState: nextState,
      decisionId: decision.id,
      reviewedAt: decision.reviewedAt,
    };
  });
}

export function reviewErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof ReviewWorkflowError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code.endsWith("_NOT_FOUND") || error.code === "IMAGE_NOT_FOUND"
          ? 404
          : error.code === "INVALID_REVIEW_TRANSITION"
            ? 409
            : 400;
    return { error: error.code, status };
  }

  return { error: "REVIEW_WORKFLOW_FAILED", status: 500 };
}
