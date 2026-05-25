import {
  AnnotationArtifactKind,
  ArtifactReviewState,
  Prisma,
  type AnnotationProjectRole,
  PrismaClient,
} from "@prisma/client";

import { canAnnotate } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import {
  IMAGE_BBOX_WORKFLOW_STATE_SELECT,
  confirmImageBBoxWorkflowState,
  markImageBBoxWorkflowChanged,
  serializeImageBBoxWorkflow,
} from "@/server/domain/imageCropWorkflow";
import {
  isVersionAllocationError,
  sliceBoundingBoxVersionFamilyKey,
  withVersionAllocationLock,
} from "@/server/domain/versionAllocation";

type SliceBBoxDb = PrismaClient | Prisma.TransactionClient;

const BBOX_MIN_SIZE_PX = 4;

export type SliceBoundingBoxInput = {
  x: unknown;
  y: unknown;
  width: unknown;
  height: unknown;
};

type ImageWithProject = {
  id: string;
  projectId: string;
  width: number | null;
  height: number | null;
};

type ValidatedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SliceBBoxGeometry = ValidatedBox & {
  bboxVersionId: string;
  sliceInstanceId: string;
};

export type SliceBBoxOverlapIssue = {
  code: "BBOX_OVERLAP";
  bboxVersionIds: [string, string];
  sliceInstanceIds: [string, string];
};

export type SliceBBoxDependencySummary = {
  derivedCropCount: number;
  semanticMaskVersionCount: number;
  supportMaskVersionCount: number;
  instanceMaskVersionCount: number;
  classificationVersionCount: number;
  hasBlockingDependencies: boolean;
};

export type SliceBBoxProtectionSummary = {
  canDelete: boolean;
  canReplaceGeometry: boolean;
  reasons: string[];
};

export class SliceBoundingBoxWorkflowError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

function canEdit(role: AnnotationProjectRole) {
  return canAnnotate(role);
}

function integerFromUnknown(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new SliceBoundingBoxWorkflowError(`${field.toUpperCase()}_INTEGER_REQUIRED`);
  }
  return value;
}

export function validateSliceBoundingBoxInput(
  input: SliceBoundingBoxInput,
  image: Pick<ImageWithProject, "width" | "height">,
): ValidatedBox {
  if (
    typeof image.width !== "number" ||
    typeof image.height !== "number" ||
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    throw new SliceBoundingBoxWorkflowError("IMAGE_DIMENSIONS_REQUIRED");
  }
  const sourceWidth = Number(image.width);
  const sourceHeight = Number(image.height);

  const x = integerFromUnknown(input.x, "x");
  const y = integerFromUnknown(input.y, "y");
  const width = integerFromUnknown(input.width, "width");
  const height = integerFromUnknown(input.height, "height");

  if (x < 0 || y < 0) throw new SliceBoundingBoxWorkflowError("BBOX_OUT_OF_BOUNDS");
  if (width < BBOX_MIN_SIZE_PX || height < BBOX_MIN_SIZE_PX) {
    throw new SliceBoundingBoxWorkflowError("BBOX_TOO_SMALL");
  }
  if (x + width > sourceWidth || y + height > sourceHeight) {
    throw new SliceBoundingBoxWorkflowError("BBOX_OUT_OF_BOUNDS");
  }

  return { x, y, width, height };
}

export function sliceBBoxesOverlap(first: ValidatedBox, second: ValidatedBox) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

export function findSliceBBoxOverlapIssues(boxes: SliceBBoxGeometry[]): SliceBBoxOverlapIssue[] {
  const issues: SliceBBoxOverlapIssue[] = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const first = boxes[i];
      const second = boxes[j];
      if (!sliceBBoxesOverlap(first, second)) continue;
      issues.push({
        code: "BBOX_OVERLAP",
        bboxVersionIds: [first.bboxVersionId, second.bboxVersionId],
        sliceInstanceIds: [first.sliceInstanceId, second.sliceInstanceId],
      });
    }
  }
  return issues;
}

function imageBBoxSetFamilyKey(imageId: string) {
  return `slice-bbox-image-set:${imageId}`;
}

async function getImageAndMembership(db: SliceBBoxDb, imageId: string, userId: string) {
  const image = await db.imageAsset.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true, width: true, height: true },
  });
  if (!image) throw new SliceBoundingBoxWorkflowError("IMAGE_NOT_FOUND");

  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId } },
    select: { role: true },
  });
  if (!membership) throw new SliceBoundingBoxWorkflowError("FORBIDDEN");

  return { image, membership };
}

async function getBBoxVersionWithAccess(db: SliceBBoxDb, bboxVersionId: string, userId: string) {
  const bbox = await db.sliceBoundingBoxVersion.findUnique({
    where: { id: bboxVersionId },
    select: {
      id: true,
      projectId: true,
      imageId: true,
      sliceInstanceId: true,
      version: true,
      status: true,
      x: true,
      y: true,
      width: true,
      height: true,
      coordinateSpace: true,
      image: { select: { id: true, projectId: true, width: true, height: true } },
    },
  });
  if (!bbox) throw new SliceBoundingBoxWorkflowError("BBOX_NOT_FOUND");

  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: bbox.projectId, userId } },
    select: { role: true },
  });
  if (!membership) throw new SliceBoundingBoxWorkflowError("FORBIDDEN");

  return { bbox, membership };
}

async function assertLatestVersion(
  db: SliceBBoxDb,
  bbox: { id: string; sliceInstanceId: string; version: number; status: string },
) {
  const latest = await db.sliceBoundingBoxVersion.findFirst({
    where: { sliceInstanceId: bbox.sliceInstanceId },
    orderBy: { version: "desc" },
    select: { id: true, status: true },
  });

  if (!latest || latest.id !== bbox.id || latest.status !== "ACTIVE") {
    throw new SliceBoundingBoxWorkflowError("BBOX_VERSION_STALE");
  }
}

function dependencySummaryFromCounts(params: {
  derivedCropCount: number;
  semanticMaskVersionCount: number;
  supportMaskVersionCount: number;
  instanceMaskVersionCount: number;
  classificationVersionCount: number;
}) {
  return {
    ...params,
    hasBlockingDependencies:
      params.semanticMaskVersionCount > 0 ||
      params.supportMaskVersionCount > 0 ||
      params.instanceMaskVersionCount > 0 ||
      params.classificationVersionCount > 0,
  } satisfies SliceBBoxDependencySummary;
}

function protectionFromDependencySummary(
  dependencySummary: SliceBBoxDependencySummary,
): SliceBBoxProtectionSummary {
  const reasons: string[] = [];
  if (dependencySummary.semanticMaskVersionCount > 0) reasons.push("SEMANTIC_MASK_EXISTS");
  if (dependencySummary.supportMaskVersionCount > 0) reasons.push("SUPPORT_MASK_EXISTS");
  if (dependencySummary.instanceMaskVersionCount > 0) reasons.push("INSTANCE_MASK_EXISTS");
  if (dependencySummary.classificationVersionCount > 0) reasons.push("CLASSIFICATION_EXISTS");

  return {
    canDelete: reasons.length === 0,
    canReplaceGeometry: reasons.length === 0,
    reasons,
  };
}

async function loadDependencySummaries(
  db: SliceBBoxDb,
  sliceInstanceIds: string[],
): Promise<Map<string, SliceBBoxDependencySummary>> {
  const summaries = new Map<string, SliceBBoxDependencySummary>();
  for (const sliceInstanceId of sliceInstanceIds) {
    summaries.set(
      sliceInstanceId,
      dependencySummaryFromCounts({
        derivedCropCount: 0,
        semanticMaskVersionCount: 0,
        supportMaskVersionCount: 0,
        instanceMaskVersionCount: 0,
        classificationVersionCount: 0,
      }),
    );
  }

  if (sliceInstanceIds.length === 0) return summaries;

  const sliceInstances = await db.sliceInstance.findMany({
    where: { id: { in: sliceInstanceIds } },
    select: {
      id: true,
      supportArtifactVersionId: true,
      supportArtifactVersion: { select: { id: true, reviewState: true } },
    },
  });
  const cropCounts = await db.derivedSliceCrop.groupBy({
    by: ["sliceInstanceId"],
    where: { sliceInstanceId: { in: sliceInstanceIds } },
    _count: { _all: true },
  });
  const classificationCounts = await db.sliceClassificationVersion.groupBy({
    by: ["sliceInstanceId"],
    where: {
      sliceInstanceId: { in: sliceInstanceIds },
      reviewState: { not: ArtifactReviewState.SUPERSEDED },
    },
    _count: { _all: true },
  });
  const artifactVersions = await db.annotationArtifactVersion.findMany({
    where: {
      sliceInstanceId: { in: sliceInstanceIds },
      reviewState: { not: ArtifactReviewState.SUPERSEDED },
      artifact: {
        kind: {
          in: [
            AnnotationArtifactKind.SEMANTIC_MASK,
            AnnotationArtifactKind.SLICE_SUPPORT_MASK,
            AnnotationArtifactKind.INSTANCE_MASK,
          ],
        },
      },
    },
    select: {
      id: true,
      sliceInstanceId: true,
      artifact: { select: { kind: true } },
    },
  });

  const draft = new Map<
    string,
    {
      derivedCropCount: number;
      semanticMaskVersionCount: number;
      supportMaskVersionCount: number;
      instanceMaskVersionCount: number;
      classificationVersionCount: number;
    }
  >();
  const countedSupportVersionIds = new Map<string, Set<string>>();
  for (const sliceInstanceId of sliceInstanceIds) {
    draft.set(sliceInstanceId, {
      derivedCropCount: 0,
      semanticMaskVersionCount: 0,
      supportMaskVersionCount: 0,
      instanceMaskVersionCount: 0,
      classificationVersionCount: 0,
    });
    countedSupportVersionIds.set(sliceInstanceId, new Set());
  }

  for (const crop of cropCounts) {
    const entry = draft.get(crop.sliceInstanceId);
    if (entry) entry.derivedCropCount = crop._count._all;
  }

  for (const classification of classificationCounts) {
    const entry = draft.get(classification.sliceInstanceId);
    if (entry) entry.classificationVersionCount = classification._count._all;
  }

  for (const version of artifactVersions) {
    if (!version.sliceInstanceId) continue;
    const entry = draft.get(version.sliceInstanceId);
    if (!entry) continue;
    if (version.artifact.kind === AnnotationArtifactKind.SEMANTIC_MASK) {
      entry.semanticMaskVersionCount += 1;
    } else if (version.artifact.kind === AnnotationArtifactKind.SLICE_SUPPORT_MASK) {
      entry.supportMaskVersionCount += 1;
      countedSupportVersionIds.get(version.sliceInstanceId)?.add(version.id);
    } else if (version.artifact.kind === AnnotationArtifactKind.INSTANCE_MASK) {
      entry.instanceMaskVersionCount += 1;
    }
  }

  for (const sliceInstance of sliceInstances) {
    if (!sliceInstance.supportArtifactVersionId) continue;
    if (sliceInstance.supportArtifactVersion?.reviewState === ArtifactReviewState.SUPERSEDED) continue;
    const entry = draft.get(sliceInstance.id);
    const countedIds = countedSupportVersionIds.get(sliceInstance.id);
    if (entry && !countedIds?.has(sliceInstance.supportArtifactVersionId)) {
      entry.supportMaskVersionCount += 1;
    }
  }

  for (const [sliceInstanceId, counts] of draft.entries()) {
    summaries.set(sliceInstanceId, dependencySummaryFromCounts(counts));
  }

  return summaries;
}

async function loadDependencySummary(db: SliceBBoxDb, sliceInstanceId: string) {
  const summaries = await loadDependencySummaries(db, [sliceInstanceId]);
  return summaries.get(sliceInstanceId) ?? dependencySummaryFromCounts({
    derivedCropCount: 0,
    semanticMaskVersionCount: 0,
    supportMaskVersionCount: 0,
    instanceMaskVersionCount: 0,
    classificationVersionCount: 0,
  });
}

function assertNoBBoxOverlaps(boxes: SliceBBoxGeometry[]) {
  if (findSliceBBoxOverlapIssues(boxes).length > 0) {
    throw new SliceBoundingBoxWorkflowError("BBOX_OVERLAP");
  }
}

async function assertProposedBoxDoesNotOverlap(
  db: SliceBBoxDb,
  imageId: string,
  box: ValidatedBox,
  excludeSliceInstanceId?: string,
) {
  const activeBoxes = await latestImageBBoxes(db, imageId);
  const comparableBoxes = activeBoxes
    .filter((activeBox) => activeBox.sliceInstanceId !== excludeSliceInstanceId)
    .map((activeBox) => ({
      bboxVersionId: activeBox.bboxVersionId,
      sliceInstanceId: activeBox.sliceInstanceId,
      x: activeBox.x,
      y: activeBox.y,
      width: activeBox.width,
      height: activeBox.height,
    }));
  assertNoBBoxOverlaps([
    ...comparableBoxes,
    {
      bboxVersionId: "candidate",
      sliceInstanceId: excludeSliceInstanceId ?? "candidate",
      ...box,
    },
  ]);
}

async function assertBBoxGeometryMutationAllowed(db: SliceBBoxDb, sliceInstanceId: string) {
  const dependencySummary = await loadDependencySummary(db, sliceInstanceId);
  if (protectionFromDependencySummary(dependencySummary).canReplaceGeometry) return;
  throw new SliceBoundingBoxWorkflowError("BBOX_GEOMETRY_PROTECTED_DEPENDENCIES");
}

async function assertBBoxDeletionAllowed(db: SliceBBoxDb, sliceInstanceId: string) {
  const dependencySummary = await loadDependencySummary(db, sliceInstanceId);
  if (protectionFromDependencySummary(dependencySummary).canDelete) return;
  throw new SliceBoundingBoxWorkflowError("BBOX_DELETE_PROTECTED_DEPENDENCIES");
}

async function invalidateBBoxDownstreamAnnotations(params: {
  db: SliceBBoxDb;
  projectId: string;
  imageId: string;
  sliceInstanceId: string;
  bboxVersionId: string;
  actorId: string;
}) {
  const artifactVersions = await params.db.annotationArtifactVersion.findMany({
    where: {
      sliceInstanceId: params.sliceInstanceId,
      reviewState: { not: ArtifactReviewState.SUPERSEDED },
      artifact: {
        projectId: params.projectId,
        imageId: params.imageId,
        kind: {
          in: [
            AnnotationArtifactKind.SEMANTIC_MASK,
            AnnotationArtifactKind.SLICE_SUPPORT_MASK,
            AnnotationArtifactKind.INSTANCE_MASK,
          ],
        },
      },
    },
    select: {
      id: true,
      artifact: { select: { kind: true } },
    },
  });
  const classifications = await params.db.sliceClassificationVersion.findMany({
    where: {
      projectId: params.projectId,
      imageId: params.imageId,
      sliceInstanceId: params.sliceInstanceId,
      reviewState: { not: ArtifactReviewState.SUPERSEDED },
    },
    select: { id: true },
  });

  const artifactVersionIds = artifactVersions.map((version) => version.id);
  const classificationIds = classifications.map((version) => version.id);

  if (artifactVersionIds.length > 0) {
    await params.db.annotationArtifactVersion.updateMany({
      where: { id: { in: artifactVersionIds } },
      data: { reviewState: ArtifactReviewState.SUPERSEDED },
    });
  }
  if (classificationIds.length > 0) {
    await params.db.sliceClassificationVersion.updateMany({
      where: { id: { in: classificationIds } },
      data: { reviewState: ArtifactReviewState.SUPERSEDED },
    });
  }

  const supportVersionIds = artifactVersions
    .filter((version) => version.artifact.kind === AnnotationArtifactKind.SLICE_SUPPORT_MASK)
    .map((version) => version.id);
  if (supportVersionIds.length > 0) {
    await params.db.sliceInstance.updateMany({
      where: {
        id: params.sliceInstanceId,
        supportArtifactVersionId: { in: supportVersionIds },
      },
      data: { supportArtifactVersionId: null },
    });
  }

  if (artifactVersionIds.length === 0 && classificationIds.length === 0) return;

  await recordAuditEvent(
    {
      action: "SLICE_BBOX_DOWNSTREAM_ANNOTATIONS_INVALIDATED",
      entity: "SliceInstance",
      entityId: params.sliceInstanceId,
      actorId: params.actorId,
      details: {
        projectId: params.projectId,
        imageId: params.imageId,
        sliceInstanceId: params.sliceInstanceId,
        bboxVersionId: params.bboxVersionId,
        artifactVersionIds,
        sliceClassificationVersionIds: classificationIds,
        semanticMaskVersionCount: artifactVersions.filter(
          (version) => version.artifact.kind === AnnotationArtifactKind.SEMANTIC_MASK,
        ).length,
        supportMaskVersionCount: supportVersionIds.length,
        instanceMaskVersionCount: artifactVersions.filter(
          (version) => version.artifact.kind === AnnotationArtifactKind.INSTANCE_MASK,
        ).length,
        classificationVersionCount: classificationIds.length,
      },
    },
    params.db,
  );
}

function currentBoundingBoxSummary(version: {
  id: string;
  version: number;
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSpace: string;
}) {
  return {
    bboxVersionId: version.id,
    version: version.version,
    x: version.x,
    y: version.y,
    width: version.width,
    height: version.height,
    coordinateSpace: version.coordinateSpace,
  };
}

function serializeBBox(version: {
  id: string;
  sliceInstanceId: string;
  version: number;
  status: string;
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSpace: string;
  provenance: string;
  createdAt: Date;
  createdBy: { id: string; email: string; name: string | null } | null;
}) {
  return {
    bboxVersionId: version.id,
    sliceInstanceId: version.sliceInstanceId,
    version: version.version,
    status: version.status,
    x: version.x,
    y: version.y,
    width: version.width,
    height: version.height,
    coordinateSpace: version.coordinateSpace,
    provenance: version.provenance,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    isCurrent: version.status === "ACTIVE",
  };
}

async function decorateBBoxesWithSafetyMetadata(
  db: SliceBBoxDb,
  boxes: Awaited<ReturnType<typeof latestImageBBoxes>>,
) {
  const dependencySummaries = await loadDependencySummaries(
    db,
    boxes.map((box) => box.sliceInstanceId),
  );

  return boxes.map((box) => {
    const dependencySummary =
      dependencySummaries.get(box.sliceInstanceId) ??
      dependencySummaryFromCounts({
        derivedCropCount: 0,
        semanticMaskVersionCount: 0,
        supportMaskVersionCount: 0,
        instanceMaskVersionCount: 0,
        classificationVersionCount: 0,
      });
    return {
      ...box,
      dependencySummary,
      protection: protectionFromDependencySummary(dependencySummary),
    };
  });
}

function summarizeBBoxState(
  boxes: Awaited<ReturnType<typeof decorateBBoxesWithSafetyMetadata>>,
  issues: SliceBBoxOverlapIssue[],
) {
  const issueBoxIds = new Set(issues.flatMap((issue) => issue.bboxVersionIds));
  return {
    activeCount: boxes.length,
    validCount: boxes.filter((box) => !issueBoxIds.has(box.bboxVersionId)).length,
    issueCount: issues.length,
    overlapIssueCount: issues.length,
    protectedCount: boxes.filter((box) => !box.protection.canDelete || !box.protection.canReplaceGeometry)
      .length,
  };
}

async function latestImageBBoxes(db: SliceBBoxDb, imageId: string) {
  const versions = await db.sliceBoundingBoxVersion.findMany({
    where: { imageId },
    orderBy: [{ sliceInstanceId: "asc" }, { version: "desc" }],
    select: {
      id: true,
      sliceInstanceId: true,
      version: true,
      status: true,
      x: true,
      y: true,
      width: true,
      height: true,
      coordinateSpace: true,
      provenance: true,
      createdAt: true,
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });

  const bySlice = new Map<string, (typeof versions)[number]>();
  for (const version of versions) {
    if (!bySlice.has(version.sliceInstanceId)) bySlice.set(version.sliceInstanceId, version);
  }

  return [...bySlice.values()]
    .filter((version) => version.status === "ACTIVE")
    .map(serializeBBox);
}

export async function listSliceBoundingBoxesForUser(params: {
  imageId: string;
  userId: string;
}, db: SliceBBoxDb = prisma) {
  const { image, membership } = await getImageAndMembership(db, params.imageId, params.userId);
  const activeBoxes = await latestImageBBoxes(db, image.id);
  const boxes = await decorateBBoxesWithSafetyMetadata(db, activeBoxes);
  const bboxIssues = findSliceBBoxOverlapIssues(activeBoxes);
  const workflowState = await db.imageCropWorkflowState.findUnique({
    where: { imageId: image.id },
    select: IMAGE_BBOX_WORKFLOW_STATE_SELECT,
  });
  const canEditBBoxes = canEdit(membership.role);

  return {
    image,
    myRole: membership.role,
    canEdit: canEditBBoxes,
    boxes,
    bboxIssues,
    bboxSummary: summarizeBBoxState(boxes, bboxIssues),
    bboxWorkflow: serializeImageBBoxWorkflow({
      state: workflowState,
      activeBBoxVersionIds: boxes.map((box) => box.bboxVersionId),
      canEdit: canEditBBoxes,
    }),
  };
}

export async function createSliceBoundingBoxForUser(params: {
  imageId: string;
  userId: string;
  box: SliceBoundingBoxInput;
}, db: SliceBBoxDb = prisma) {
  const { image, membership } = await getImageAndMembership(db, params.imageId, params.userId);
  if (!canEdit(membership.role)) throw new SliceBoundingBoxWorkflowError("FORBIDDEN");

  const box = validateSliceBoundingBoxInput(params.box, image);

  const created = await db.$transaction((tx) =>
    withVersionAllocationLock(tx, imageBBoxSetFamilyKey(image.id), async () => {
      await assertProposedBoxDoesNotOverlap(tx, image.id, box);

      const sliceInstance = await tx.sliceInstance.create({
        data: {
          projectId: image.projectId,
          imageId: image.id,
          createdById: params.userId,
        },
        select: { id: true },
      });

      const bbox = await tx.sliceBoundingBoxVersion.create({
        data: {
          projectId: image.projectId,
          imageId: image.id,
          sliceInstanceId: sliceInstance.id,
          version: 1,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          coordinateSpace: "SOURCE_IMAGE_PIXEL",
          provenance: "HUMAN_ANNOTATION",
          createdById: params.userId,
        },
        select: {
          id: true,
          sliceInstanceId: true,
          version: true,
          status: true,
          x: true,
          y: true,
          width: true,
          height: true,
          coordinateSpace: true,
          provenance: true,
          createdAt: true,
          createdBy: { select: { id: true, email: true, name: true } },
        },
      });

      await tx.sliceInstance.update({
        where: { id: sliceInstance.id },
        data: { boundingBox: currentBoundingBoxSummary(bbox) },
      });

      await markImageBBoxWorkflowChanged({
        db: tx,
        projectId: image.projectId,
        imageId: image.id,
        bboxVersionId: bbox.id,
        actorId: params.userId,
      });

      await recordAuditEvent(
        {
          action: "SLICE_BBOX_CREATED",
          entity: "SliceBoundingBoxVersion",
          entityId: bbox.id,
          actorId: params.userId,
          details: {
            projectId: image.projectId,
            imageId: image.id,
            sliceInstanceId: sliceInstance.id,
            version: bbox.version,
            box,
            coordinateSpace: bbox.coordinateSpace,
          },
        },
        tx,
      );

      return bbox;
    }),
  );

  return serializeBBox(created);
}

export async function replaceSliceBoundingBoxForUser(params: {
  bboxVersionId: string;
  userId: string;
  box: SliceBoundingBoxInput;
  allowDependencyInvalidation?: boolean;
}, db: SliceBBoxDb = prisma) {
  const { bbox, membership } = await getBBoxVersionWithAccess(db, params.bboxVersionId, params.userId);
  if (!canEdit(membership.role)) throw new SliceBoundingBoxWorkflowError("FORBIDDEN");
  await assertLatestVersion(db, bbox);

  const box = validateSliceBoundingBoxInput(params.box, bbox.image);

  const created = await db.$transaction((tx) =>
    withVersionAllocationLock(
      tx,
      imageBBoxSetFamilyKey(bbox.imageId),
      async () => {
        await assertProposedBoxDoesNotOverlap(tx, bbox.imageId, box, bbox.sliceInstanceId);
        if (params.allowDependencyInvalidation) {
          await invalidateBBoxDownstreamAnnotations({
            db: tx,
            projectId: bbox.projectId,
            imageId: bbox.imageId,
            sliceInstanceId: bbox.sliceInstanceId,
            bboxVersionId: bbox.id,
            actorId: params.userId,
          });
        } else {
          await assertBBoxGeometryMutationAllowed(tx, bbox.sliceInstanceId);
        }

        return withVersionAllocationLock(
          tx,
          sliceBoundingBoxVersionFamilyKey(bbox.sliceInstanceId),
          async () => {
            const latest = await tx.sliceBoundingBoxVersion.findFirst({
              where: { sliceInstanceId: bbox.sliceInstanceId },
              orderBy: { version: "desc" },
              select: { id: true, version: true, status: true },
            });
            if (!latest || latest.id !== bbox.id || latest.status !== "ACTIVE") {
              throw new SliceBoundingBoxWorkflowError("BBOX_VERSION_STALE");
            }

            const next = await tx.sliceBoundingBoxVersion.create({
              data: {
                projectId: bbox.projectId,
                imageId: bbox.imageId,
                sliceInstanceId: bbox.sliceInstanceId,
                version: latest.version + 1,
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                coordinateSpace: "SOURCE_IMAGE_PIXEL",
                provenance: "HUMAN_ANNOTATION",
                createdById: params.userId,
                metadataJson: { replacesBBoxVersionId: bbox.id },
              },
              select: {
                id: true,
                sliceInstanceId: true,
                version: true,
                status: true,
                x: true,
                y: true,
                width: true,
                height: true,
                coordinateSpace: true,
                provenance: true,
                createdAt: true,
                createdBy: { select: { id: true, email: true, name: true } },
              },
            });

            await tx.sliceInstance.update({
              where: { id: bbox.sliceInstanceId },
              data: { boundingBox: currentBoundingBoxSummary(next) },
            });

            await markImageBBoxWorkflowChanged({
              db: tx,
              projectId: bbox.projectId,
              imageId: bbox.imageId,
              bboxVersionId: next.id,
              actorId: params.userId,
            });

            await recordAuditEvent(
              {
                action: "SLICE_BBOX_REPLACED",
                entity: "SliceBoundingBoxVersion",
                entityId: next.id,
                actorId: params.userId,
                details: {
                  projectId: bbox.projectId,
                  imageId: bbox.imageId,
                  sliceInstanceId: bbox.sliceInstanceId,
                  previousBBoxVersionId: bbox.id,
                  version: next.version,
                  box,
                  coordinateSpace: next.coordinateSpace,
                },
              },
              tx,
            );

            return next;
          },
        );
      },
    ),
  );

  return serializeBBox(created);
}

export async function deleteSliceBoundingBoxForUser(params: {
  bboxVersionId: string;
  userId: string;
  allowDependencyInvalidation?: boolean;
}, db: SliceBBoxDb = prisma) {
  const { bbox, membership } = await getBBoxVersionWithAccess(db, params.bboxVersionId, params.userId);
  if (!canEdit(membership.role)) throw new SliceBoundingBoxWorkflowError("FORBIDDEN");
  await assertLatestVersion(db, bbox);

  const deleted = await db.$transaction((tx) =>
    withVersionAllocationLock(
      tx,
      imageBBoxSetFamilyKey(bbox.imageId),
      async () => {
        if (params.allowDependencyInvalidation) {
          await invalidateBBoxDownstreamAnnotations({
            db: tx,
            projectId: bbox.projectId,
            imageId: bbox.imageId,
            sliceInstanceId: bbox.sliceInstanceId,
            bboxVersionId: bbox.id,
            actorId: params.userId,
          });
        } else {
          await assertBBoxDeletionAllowed(tx, bbox.sliceInstanceId);
        }

        return withVersionAllocationLock(
          tx,
          sliceBoundingBoxVersionFamilyKey(bbox.sliceInstanceId),
          async () => {
            const latest = await tx.sliceBoundingBoxVersion.findFirst({
              where: { sliceInstanceId: bbox.sliceInstanceId },
              orderBy: { version: "desc" },
              select: { id: true, version: true, status: true },
            });
            if (!latest || latest.id !== bbox.id || latest.status !== "ACTIVE") {
              throw new SliceBoundingBoxWorkflowError("BBOX_VERSION_STALE");
            }

            const next = await tx.sliceBoundingBoxVersion.create({
              data: {
                projectId: bbox.projectId,
                imageId: bbox.imageId,
                sliceInstanceId: bbox.sliceInstanceId,
                version: latest.version + 1,
                status: "DELETED",
                x: bbox.x,
                y: bbox.y,
                width: bbox.width,
                height: bbox.height,
                coordinateSpace: "SOURCE_IMAGE_PIXEL",
                provenance: "HUMAN_ANNOTATION",
                createdById: params.userId,
                metadataJson: { deletesBBoxVersionId: bbox.id },
              },
              select: {
                id: true,
                sliceInstanceId: true,
                version: true,
                status: true,
                x: true,
                y: true,
                width: true,
                height: true,
                coordinateSpace: true,
                provenance: true,
                createdAt: true,
                createdBy: { select: { id: true, email: true, name: true } },
              },
            });

            await tx.sliceInstance.update({
              where: { id: bbox.sliceInstanceId },
              data: { boundingBox: Prisma.JsonNull },
            });

            await markImageBBoxWorkflowChanged({
              db: tx,
              projectId: bbox.projectId,
              imageId: bbox.imageId,
              bboxVersionId: next.id,
              actorId: params.userId,
            });

            await recordAuditEvent(
              {
                action: "SLICE_BBOX_DELETED",
                entity: "SliceBoundingBoxVersion",
                entityId: next.id,
                actorId: params.userId,
                details: {
                  projectId: bbox.projectId,
                  imageId: bbox.imageId,
                  sliceInstanceId: bbox.sliceInstanceId,
                  previousBBoxVersionId: bbox.id,
                  version: next.version,
                },
              },
              tx,
            );

            return next;
          },
        );
      },
    ),
  );

  return serializeBBox(deleted);
}

export async function confirmImageBBoxSetForUser(params: {
  imageId: string;
  userId: string;
}, db: PrismaClient = prisma) {
  const { image, membership } = await getImageAndMembership(db, params.imageId, params.userId);
  if (!canEdit(membership.role)) throw new SliceBoundingBoxWorkflowError("FORBIDDEN");

  const confirmed = await db.$transaction(async (tx) => {
    return withVersionAllocationLock(tx, imageBBoxSetFamilyKey(image.id), async () => {
      const boxes = await latestImageBBoxes(tx, image.id);
      if (boxes.length === 0) throw new SliceBoundingBoxWorkflowError("BBOX_SET_EMPTY");
      assertNoBBoxOverlaps(boxes);

      const workflowState = await confirmImageBBoxWorkflowState({
        db: tx,
        projectId: image.projectId,
        imageId: image.id,
        activeBBoxVersionIds: boxes.map((box) => box.bboxVersionId),
        actorId: params.userId,
      });
      const decoratedBoxes = await decorateBBoxesWithSafetyMetadata(tx, boxes);
      const bboxIssues = findSliceBBoxOverlapIssues(boxes);

      return {
        boxes: decoratedBoxes,
        bboxIssues,
        bboxSummary: summarizeBBoxState(decoratedBoxes, bboxIssues),
        bboxWorkflow: serializeImageBBoxWorkflow({
          state: workflowState,
          activeBBoxVersionIds: boxes.map((box) => box.bboxVersionId),
          canEdit: true,
        }),
      };
    });
  });

  return confirmed;
}

export function sliceBoundingBoxErrorResponse(error: unknown): { error: string; status: number } {
  if (isVersionAllocationError(error)) {
    return { error: error.code, status: error.status };
  }

  if (error instanceof SliceBoundingBoxWorkflowError) {
    const conflictCodes = new Set([
      "BBOX_OVERLAP",
      "BBOX_DELETE_PROTECTED_DEPENDENCIES",
      "BBOX_GEOMETRY_PROTECTED_DEPENDENCIES",
    ]);
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code.endsWith("_NOT_FOUND") || error.code === "IMAGE_NOT_FOUND"
          ? 404
          : conflictCodes.has(error.code)
            ? 409
          : 400;
    return { error: error.code, status };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { error: "SLICE_BBOX_DB_ERROR", status: 500 };
  }

  return { error: "SLICE_BBOX_FAILED", status: 500 };
}
