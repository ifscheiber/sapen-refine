import { ArtifactReviewState, type Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import { resolveCropWorkflowReadinessForUser } from "@/server/domain/cropReadiness";
import {
  canReview,
  canSubmitReview,
  nextReviewStateForAction,
  ReviewWorkflowError,
  type ReviewAction,
} from "@/server/domain/review";

type ImageReviewDb = PrismaClient | Prisma.TransactionClient;

type ReviewTarget = {
  id: string;
  kind: "artifact" | "classification";
  type: "SLICE_SUPPORT_MASK" | "SEMANTIC_MASK" | "SLICE_CLASSIFICATION";
  cropId: string;
  sliceInstanceId: string;
  reviewState: ArtifactReviewState;
  version: number;
};

const SUBMIT_BLOCKING_REASONS = new Set([
  "MISSING_IMAGE_CHECKSUM",
  "MISSING_IMAGE_DIMENSIONS",
  "MISSING_CROP_INTEGRITY_METADATA",
  "MISSING_SUPPORT_MASK",
  "MISSING_SEMANTIC_MASK",
  "MISSING_CLASSIFICATION",
  "LINEAGE_MISMATCH",
  "SUPPORT_SEMANTIC_MISMATCH",
  "CLASSIFICATION_SEMANTIC_MISMATCH",
  "COORDINATE_SPACE_MISMATCH",
  "CROP_NOT_CURRENT",
  "CLASSIFICATION_STALE",
  "SEMANTIC_OUTSIDE_SUPPORT",
  "SUPPORT_SEMANTIC_VALIDATION_FAILED",
  "SEMANTIC_FAMILY_CONFLICT",
  "CLASSIFICATION_SEMANTIC_FAMILY_MISMATCH",
  "MISSING_SUPPORT_MASK_INTEGRITY_METADATA",
  "MISSING_SEMANTIC_MASK_INTEGRITY_METADATA",
]);

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function loadImageMembership(db: ImageReviewDb, imageId: string, userId: string) {
  const image = await db.imageAsset.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      projectId: true,
      filename: true,
      annotationReview: {
        select: {
          id: true,
          state: true,
          snapshotJson: true,
          submittedAt: true,
          reviewedAt: true,
          comments: true,
          reason: true,
          submittedBy: { select: { id: true, email: true, name: true } },
          reviewedBy: { select: { id: true, email: true, name: true } },
        },
      },
      project: {
        select: {
          members: {
            where: { userId },
            select: { role: true },
          },
        },
      },
    },
  });
  if (!image) throw new ReviewWorkflowError("IMAGE_NOT_FOUND");
  const membership = image.project.members[0];
  if (!membership) throw new ReviewWorkflowError("FORBIDDEN");
  return { image, role: membership.role };
}

function addTarget(targets: Map<string, ReviewTarget>, target: ReviewTarget | null) {
  if (!target) return;
  targets.set(`${target.kind}:${target.id}`, target);
}

function collectTargets(readiness: Awaited<ReturnType<typeof resolveCropWorkflowReadinessForUser>>) {
  const allTargets = new Map<string, ReviewTarget>();
  const blockingReasons = new Set<string>();

  for (const candidate of readiness.candidates) {
    for (const reason of candidate.readinessReasons) {
      if (SUBMIT_BLOCKING_REASONS.has(reason)) blockingReasons.add(reason);
    }

    addTarget(
      allTargets,
      candidate.latestSupportMask
        ? {
            id: candidate.latestSupportMask.id,
            kind: "artifact",
            type: "SLICE_SUPPORT_MASK",
            cropId: candidate.crop.id,
            sliceInstanceId: candidate.crop.sliceInstanceId,
            reviewState: candidate.latestSupportMask.reviewState,
            version: candidate.latestSupportMask.version,
          }
        : null,
    );
    addTarget(
      allTargets,
      candidate.latestSemanticMask
        ? {
            id: candidate.latestSemanticMask.id,
            kind: "artifact",
            type: "SEMANTIC_MASK",
            cropId: candidate.crop.id,
            sliceInstanceId: candidate.crop.sliceInstanceId,
            reviewState: candidate.latestSemanticMask.reviewState,
            version: candidate.latestSemanticMask.version,
          }
        : null,
    );
    addTarget(
      allTargets,
      candidate.latestClassification
        ? {
            id: candidate.latestClassification.id,
            kind: "classification",
            type: "SLICE_CLASSIFICATION",
            cropId: candidate.crop.id,
            sliceInstanceId: candidate.crop.sliceInstanceId,
            reviewState: candidate.latestClassification.reviewState,
            version: candidate.latestClassification.version,
          }
        : null,
    );
  }

  return {
    targets: Array.from(allTargets.values()).sort((left, right) =>
      `${left.sliceInstanceId}:${left.type}:${left.id}`.localeCompare(`${right.sliceInstanceId}:${right.type}:${right.id}`),
    ),
    blockingReasons: Array.from(blockingReasons).sort(),
  };
}

function targetSummary(targets: ReviewTarget[]) {
  return {
    totalTargets: targets.length,
    draftTargets: targets.filter((target) => target.reviewState === ArtifactReviewState.DRAFT).length,
    submittedTargets: targets.filter((target) => target.reviewState === ArtifactReviewState.SUBMITTED).length,
    approvedTargets: targets.filter((target) => target.reviewState === ArtifactReviewState.APPROVED).length,
    rejectedTargets: targets.filter((target) => target.reviewState === ArtifactReviewState.REJECTED).length,
  };
}

function derivedImageState(
  persisted: ArtifactReviewState | null | undefined,
  summary: ReturnType<typeof targetSummary>,
) {
  if (persisted) return persisted;
  if (summary.totalTargets > 0 && summary.approvedTargets === summary.totalTargets) return ArtifactReviewState.APPROVED;
  if (summary.submittedTargets > 0) return ArtifactReviewState.SUBMITTED;
  if (summary.rejectedTargets > 0) return ArtifactReviewState.REJECTED;
  return ArtifactReviewState.DRAFT;
}

function transitionTargetsForAction(targets: ReviewTarget[], action: ReviewAction) {
  const expectedState =
    action === "submit" ? ArtifactReviewState.DRAFT : ArtifactReviewState.SUBMITTED;
  return targets.filter((target) => target.reviewState === expectedState);
}

function buildSnapshot(params: {
  imageId: string;
  projectId: string;
  action: ReviewAction;
  targets: ReviewTarget[];
  blockingReasons: string[];
}): Prisma.InputJsonObject {
  return {
    imageId: params.imageId,
    projectId: params.projectId,
    action: params.action,
    targetCount: params.targets.length,
    blockingReasons: params.blockingReasons,
    targets: params.targets.map((target) => ({
      id: target.id,
      kind: target.kind,
      type: target.type,
      cropId: target.cropId,
      sliceInstanceId: target.sliceInstanceId,
      version: target.version,
      reviewState: target.reviewState,
    })),
  };
}

export async function loadImageAnnotationReviewForUser(params: {
  imageId: string;
  userId: string;
}, db: ImageReviewDb = prisma) {
  const { image, role } = await loadImageMembership(db, params.imageId, params.userId);
  const readiness = await resolveCropWorkflowReadinessForUser({
    projectId: image.projectId,
    imageId: image.id,
    userId: params.userId,
  }, db);
  const { targets, blockingReasons } = collectTargets(readiness);
  const summary = targetSummary(targets);
  const state = derivedImageState(image.annotationReview?.state, summary);
  const submittableTargets = transitionTargetsForAction(targets, "submit");
  const reviewableTargets = transitionTargetsForAction(targets, "approve");

  return {
    image: { id: image.id, projectId: image.projectId, filename: image.filename },
    state,
    persistedReview: image.annotationReview,
    permissions: {
      canSubmit: canSubmitReview(role),
      canReview: canReview(role),
    },
    actions: {
      canSubmit: canSubmitReview(role) && blockingReasons.length === 0 && submittableTargets.length > 0,
      canApprove: canReview(role) && state === ArtifactReviewState.SUBMITTED && reviewableTargets.length > 0,
      canReject: canReview(role) && state === ArtifactReviewState.SUBMITTED && reviewableTargets.length > 0,
    },
    summary,
    blockingReasons,
    targets,
  };
}

async function transitionTarget(params: {
  tx: Prisma.TransactionClient;
  imageId: string;
  projectId: string;
  userId: string;
  action: ReviewAction;
  target: ReviewTarget;
  comment: string | null;
  reason: string | null;
}) {
  const nextState = nextReviewStateForAction({
    action: params.action,
    currentState: params.target.reviewState,
    comment: params.comment,
    reason: params.reason,
  });

  if (params.target.kind === "artifact") {
    const updated = await params.tx.annotationArtifactVersion.updateMany({
      where: { id: params.target.id, reviewState: params.target.reviewState },
      data: { reviewState: nextState },
    });
    if (updated.count !== 1) throw new ReviewWorkflowError("REVIEW_TARGET_CHANGED");
    const decision = await params.tx.reviewDecision.create({
      data: {
        projectId: params.projectId,
        artifactVersionId: params.target.id,
        fromState: params.target.reviewState,
        toState: nextState,
        reviewedById: params.userId,
        comments: params.comment,
        reason: params.reason,
      },
      select: { id: true },
    });
    await recordAuditEvent({
      action: "REVIEW_DECISION_RECORDED",
      entity: "ReviewDecision",
      entityId: decision.id,
      actorId: params.userId,
      details: {
        projectId: params.projectId,
        imageId: params.imageId,
        artifactVersionId: params.target.id,
        targetType: params.target.type,
        action: params.action,
        fromState: params.target.reviewState,
        toState: nextState,
      },
    }, params.tx);
    return;
  }

  const updated = await params.tx.sliceClassificationVersion.updateMany({
    where: { id: params.target.id, reviewState: params.target.reviewState },
    data: { reviewState: nextState },
  });
  if (updated.count !== 1) throw new ReviewWorkflowError("REVIEW_TARGET_CHANGED");
  const decision = await params.tx.reviewDecision.create({
    data: {
      projectId: params.projectId,
      sliceClassificationVersionId: params.target.id,
      fromState: params.target.reviewState,
      toState: nextState,
      reviewedById: params.userId,
      comments: params.comment,
      reason: params.reason,
    },
    select: { id: true },
  });
  await recordAuditEvent({
    action: "REVIEW_DECISION_RECORDED",
    entity: "ReviewDecision",
    entityId: decision.id,
    actorId: params.userId,
    details: {
      projectId: params.projectId,
      imageId: params.imageId,
      sliceClassificationVersionId: params.target.id,
      targetType: params.target.type,
      action: params.action,
      fromState: params.target.reviewState,
      toState: nextState,
    },
  }, params.tx);
}

export async function transitionImageAnnotationReviewForUser(params: {
  imageId: string;
  userId: string;
  action: ReviewAction;
  comment?: string | null;
  reason?: string | null;
}, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const current = await loadImageAnnotationReviewForUser({
      imageId: params.imageId,
      userId: params.userId,
    }, tx);
    const comment = cleanText(params.comment);
    const reason = cleanText(params.reason);

    if (params.action === "submit" && !current.permissions.canSubmit) {
      throw new ReviewWorkflowError("FORBIDDEN");
    }
    if ((params.action === "approve" || params.action === "reject") && !current.permissions.canReview) {
      throw new ReviewWorkflowError("FORBIDDEN");
    }
    if (params.action === "submit" && current.blockingReasons.length > 0) {
      throw new ReviewWorkflowError("IMAGE_REVIEW_SUBMIT_BLOCKED");
    }

    const targets = transitionTargetsForAction(current.targets, params.action);
    if (targets.length === 0) throw new ReviewWorkflowError("IMAGE_REVIEW_NO_TARGETS");

    for (const target of targets) {
      await transitionTarget({
        tx,
        imageId: current.image.id,
        projectId: current.image.projectId,
        userId: params.userId,
        action: params.action,
        target,
        comment,
        reason,
      });
    }

    const nextState =
      params.action === "submit"
        ? ArtifactReviewState.SUBMITTED
        : params.action === "approve"
          ? ArtifactReviewState.APPROVED
          : ArtifactReviewState.REJECTED;
    const snapshot = buildSnapshot({
      imageId: current.image.id,
      projectId: current.image.projectId,
      action: params.action,
      targets,
      blockingReasons: current.blockingReasons,
    });

    const review = await tx.imageAnnotationReview.upsert({
      where: { imageId: current.image.id },
      create: {
        projectId: current.image.projectId,
        imageId: current.image.id,
        state: nextState,
        snapshotJson: snapshot,
        submittedById: params.action === "submit" ? params.userId : undefined,
        submittedAt: params.action === "submit" ? new Date() : undefined,
        reviewedById: params.action === "submit" ? undefined : params.userId,
        reviewedAt: params.action === "submit" ? undefined : new Date(),
        comments: comment,
        reason,
      },
      update: {
        state: nextState,
        snapshotJson: snapshot,
        ...(params.action === "submit"
          ? { submittedById: params.userId, submittedAt: new Date(), reviewedById: null, reviewedAt: null }
          : { reviewedById: params.userId, reviewedAt: new Date() }),
        comments: comment,
        reason,
      },
      select: { id: true },
    });

    await recordAuditEvent({
      action: "IMAGE_ANNOTATION_REVIEW_TRANSITIONED",
      entity: "ImageAnnotationReview",
      entityId: review.id,
      actorId: params.userId,
      details: {
        projectId: current.image.projectId,
        imageId: current.image.id,
        action: params.action,
        toState: nextState,
        targetCount: targets.length,
      },
    }, tx);

    return loadImageAnnotationReviewForUser({ imageId: params.imageId, userId: params.userId }, tx);
  });
}
