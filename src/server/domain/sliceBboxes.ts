import { Prisma, type AnnotationProjectRole, PrismaClient } from "@prisma/client";

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
  const boxes = await latestImageBBoxes(db, image.id);
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

  const created = await db.$transaction(async (tx) => {
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
  });

  return serializeBBox(created);
}

export async function replaceSliceBoundingBoxForUser(params: {
  bboxVersionId: string;
  userId: string;
  box: SliceBoundingBoxInput;
}, db: SliceBBoxDb = prisma) {
  const { bbox, membership } = await getBBoxVersionWithAccess(db, params.bboxVersionId, params.userId);
  if (!canEdit(membership.role)) throw new SliceBoundingBoxWorkflowError("FORBIDDEN");
  await assertLatestVersion(db, bbox);

  const box = validateSliceBoundingBoxInput(params.box, bbox.image);

  const created = await db.$transaction((tx) =>
    withVersionAllocationLock(
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
    ),
  );

  return serializeBBox(created);
}

export async function deleteSliceBoundingBoxForUser(params: {
  bboxVersionId: string;
  userId: string;
}, db: SliceBBoxDb = prisma) {
  const { bbox, membership } = await getBBoxVersionWithAccess(db, params.bboxVersionId, params.userId);
  if (!canEdit(membership.role)) throw new SliceBoundingBoxWorkflowError("FORBIDDEN");
  await assertLatestVersion(db, bbox);

  const deleted = await db.$transaction((tx) =>
    withVersionAllocationLock(
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
    const boxes = await latestImageBBoxes(tx, image.id);
    if (boxes.length === 0) throw new SliceBoundingBoxWorkflowError("BBOX_SET_EMPTY");

    const workflowState = await confirmImageBBoxWorkflowState({
      db: tx,
      projectId: image.projectId,
      imageId: image.id,
      activeBBoxVersionIds: boxes.map((box) => box.bboxVersionId),
      actorId: params.userId,
    });

    return {
      boxes,
      bboxWorkflow: serializeImageBBoxWorkflow({
        state: workflowState,
        activeBBoxVersionIds: boxes.map((box) => box.bboxVersionId),
        canEdit: true,
      }),
    };
  });

  return confirmed;
}

export function sliceBoundingBoxErrorResponse(error: unknown): { error: string; status: number } {
  if (isVersionAllocationError(error)) {
    return { error: error.code, status: error.status };
  }

  if (error instanceof SliceBoundingBoxWorkflowError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code.endsWith("_NOT_FOUND") || error.code === "IMAGE_NOT_FOUND"
          ? 404
          : 400;
    return { error: error.code, status };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { error: "SLICE_BBOX_DB_ERROR", status: 500 };
  }

  return { error: "SLICE_BBOX_FAILED", status: 500 };
}
