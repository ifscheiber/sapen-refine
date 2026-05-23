import {
  AnnotationArtifactKind,
  Prisma,
  SliceClass,
  type AnnotationProjectRole,
} from "@prisma/client";

import { canAnnotate } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import { isSupportMaskArtifactKind } from "./artifacts";

type SliceDb = typeof prisma;

export const DEFAULT_SLICE_SCOPE_KEY = "default";

const SLICE_CLASSES = new Set<string>(Object.values(SliceClass));

export class SliceWorkflowError extends Error {
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

function isSliceClass(value: unknown): value is SliceClass {
  return typeof value === "string" && SLICE_CLASSES.has(value);
}

async function getImageAndMembership(db: SliceDb, imageId: string, userId: string) {
  const image = await db.imageAsset.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true, width: true, height: true },
  });
  if (!image) throw new SliceWorkflowError("IMAGE_NOT_FOUND");

  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId } },
    select: { role: true },
  });
  if (!membership) throw new SliceWorkflowError("FORBIDDEN");

  return { image, membership };
}

export async function getProjectLabelSchemaVersionId(db: SliceDb, projectId: string) {
  const project = await db.annotationProject.findUnique({
    where: { id: projectId },
    select: { labelSchemaVersionId: true },
  });

  if (project?.labelSchemaVersionId) return project.labelSchemaVersionId;

  const fallback = await db.labelSchemaVersion.findFirst({
    where: { isDefault: true, status: "ACTIVE" },
    select: { id: true },
  });
  if (!fallback) throw new SliceWorkflowError("DEFAULT_LABEL_SCHEMA_MISSING");
  return fallback.id;
}

export async function getSupportLabelValues(db: SliceDb, labelSchemaVersionId: string) {
  const support = await db.labelDefinition.findUnique({
    where: {
      schemaVersionId_stableId: {
        schemaVersionId: labelSchemaVersionId,
        stableId: "slice_support",
      },
    },
    select: { byteValue: true, applicability: true },
  });

  if (!support || support.applicability !== "SUPPORT_MASK" || support.byteValue === null) {
    throw new SliceWorkflowError("SLICE_SUPPORT_LABEL_MISSING");
  }

  return {
    background: 0,
    sliceSupport: support.byteValue,
  };
}

async function findDefaultSliceInstance(db: SliceDb, image: { id: string; projectId: string }) {
  return db.sliceInstance.findFirst({
    where: { imageId: image.id, projectId: image.projectId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      supportArtifactVersionId: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });
}

async function createDefaultSliceInstance(
  db: SliceDb,
  image: { id: string; projectId: string },
  userId: string,
) {
  return db.sliceInstance.create({
    data: {
      projectId: image.projectId,
      imageId: image.id,
      createdById: userId,
    },
    select: {
      id: true,
      supportArtifactVersionId: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });
}

async function getOrCreateDefaultSliceInstance(
  db: SliceDb,
  image: { id: string; projectId: string },
  userId: string,
) {
  return (await findDefaultSliceInstance(db, image)) ?? createDefaultSliceInstance(db, image, userId);
}

export function pickLatestSliceClassification<T extends { version: number }>(items: T[]): T | null {
  return items.reduce<T | null>((latest, item) => {
    if (!latest || item.version > latest.version) return item;
    return latest;
  }, null);
}

export async function assertSupportArtifactVersionForImage(params: {
  versionId: string;
  imageId: string;
  projectId?: string;
}, db: SliceDb = prisma) {
  const version = await db.annotationArtifactVersion.findUnique({
    where: { id: params.versionId },
    select: {
      id: true,
      width: true,
      height: true,
      artifact: {
        select: {
          id: true,
          imageId: true,
          projectId: true,
          kind: true,
        },
      },
    },
  });

  if (!version || version.artifact.imageId !== params.imageId) {
    throw new SliceWorkflowError("SUPPORT_VERSION_NOT_FOUND");
  }
  if (params.projectId && version.artifact.projectId !== params.projectId) {
    throw new SliceWorkflowError("SUPPORT_VERSION_NOT_FOUND");
  }
  if (!isSupportMaskArtifactKind(version.artifact.kind)) {
    throw new SliceWorkflowError("ARTIFACT_NOT_SUPPORT_GEOMETRY");
  }

  return version;
}

async function getLatestSupportMask(db: SliceDb, imageId: string) {
  const artifact = await db.annotationArtifact.findUnique({
    where: {
      imageId_kind_scopeKey: {
        imageId,
        kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
        scopeKey: DEFAULT_SLICE_SCOPE_KEY,
      },
    },
    select: { id: true },
  });
  if (!artifact) return null;

  return db.annotationArtifactVersion.findFirst({
    where: { artifactId: artifact.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      size: true,
      width: true,
      height: true,
      format: true,
      reviewState: true,
      createdAt: true,
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });
}

async function getLatestClassification(db: SliceDb, sliceInstanceId: string) {
  return db.sliceClassificationVersion.findFirst({
    where: { sliceInstanceId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      class: true,
      reviewState: true,
      labelSchemaVersionId: true,
      createdAt: true,
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function loadSliceStateForUser(params: {
  imageId: string;
  userId: string;
}, db: SliceDb = prisma) {
  const { image, membership } = await getImageAndMembership(db, params.imageId, params.userId);
  const labelSchemaVersionId = await getProjectLabelSchemaVersionId(db, image.projectId);
  const supportLabels = await getSupportLabelValues(db, labelSchemaVersionId);
  const sliceInstance = await findDefaultSliceInstance(db, image);
  const latestSupportMask = await getLatestSupportMask(db, image.id);
  const latestClassification = sliceInstance
    ? await getLatestClassification(db, sliceInstance.id)
    : null;

  return {
    image,
    myRole: membership.role,
    canEdit: canEdit(membership.role),
    labelSchemaVersionId,
    supportLabels,
    sliceInstance,
    latestSupportMask,
    latestClassification,
  };
}

export async function ensureDefaultSliceInstanceForUser(params: {
  imageId: string;
  userId: string;
}, db: SliceDb = prisma) {
  const { image, membership } = await getImageAndMembership(db, params.imageId, params.userId);
  if (!canEdit(membership.role)) throw new SliceWorkflowError("FORBIDDEN");

  await getOrCreateDefaultSliceInstance(db, image, params.userId);
  return loadSliceStateForUser(params, db);
}

export async function createSupportMaskVersionForUser(params: {
  imageId: string;
  userId: string;
  storageKey: string;
  contentType?: string | null;
  size: number;
  checksum?: string | null;
  width: number;
  height: number;
  format?: string | null;
}, db: SliceDb = prisma) {
  const { image, membership } = await getImageAndMembership(db, params.imageId, params.userId);
  if (!canEdit(membership.role)) throw new SliceWorkflowError("FORBIDDEN");

  if (!Number.isInteger(params.width) || params.width <= 0) {
    throw new SliceWorkflowError("WIDTH_REQUIRED");
  }
  if (!Number.isInteger(params.height) || params.height <= 0) {
    throw new SliceWorkflowError("HEIGHT_REQUIRED");
  }
  if (!Number.isInteger(params.size) || params.size <= 0) {
    throw new SliceWorkflowError("SIZE_REQUIRED");
  }
  if (params.size !== params.width * params.height) {
    throw new SliceWorkflowError("MASK_SIZE_MISMATCH");
  }
  if ((image.width && image.width !== params.width) || (image.height && image.height !== params.height)) {
    throw new SliceWorkflowError("MASK_DIMENSION_MISMATCH");
  }

  const labelSchemaVersionId = await getProjectLabelSchemaVersionId(db, image.projectId);
  const artifact = await db.annotationArtifact.upsert({
    where: {
      imageId_kind_scopeKey: {
        imageId: image.id,
        kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
        scopeKey: DEFAULT_SLICE_SCOPE_KEY,
      },
    },
    update: {},
    create: {
      projectId: image.projectId,
      imageId: image.id,
      kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      scopeKey: DEFAULT_SLICE_SCOPE_KEY,
      createdById: params.userId,
    },
    select: { id: true },
  });

  const last = await db.annotationArtifactVersion.findFirst({
    where: { artifactId: artifact.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const version = await db.annotationArtifactVersion.create({
    data: {
      artifactId: artifact.id,
      version: (last?.version ?? 0) + 1,
      storageKey: params.storageKey,
      contentType: params.contentType ?? "application/octet-stream",
      size: params.size,
      checksum: params.checksum ?? null,
      width: params.width,
      height: params.height,
      format: params.format?.trim() || "u8raw-v1",
      labelSchemaVersionId,
      createdById: params.userId,
    },
    select: { id: true },
  });

  await assertSupportArtifactVersionForImage(
    { versionId: version.id, imageId: image.id, projectId: image.projectId },
    db,
  );

  const sliceInstance = await getOrCreateDefaultSliceInstance(db, image, params.userId);
  await db.sliceInstance.update({
    where: { id: sliceInstance.id },
    data: { supportArtifactVersionId: version.id },
  });

  return loadSliceStateForUser({ imageId: image.id, userId: params.userId }, db);
}

export async function setSliceClassificationForUser(params: {
  imageId: string;
  userId: string;
  class: unknown;
}, db: SliceDb = prisma) {
  if (!isSliceClass(params.class)) throw new SliceWorkflowError("SLICE_CLASS_INVALID");

  const { image, membership } = await getImageAndMembership(db, params.imageId, params.userId);
  if (!canEdit(membership.role)) throw new SliceWorkflowError("FORBIDDEN");

  const labelSchemaVersionId = await getProjectLabelSchemaVersionId(db, image.projectId);
  const sliceInstance = await getOrCreateDefaultSliceInstance(db, image, params.userId);
  const last = await db.sliceClassificationVersion.findFirst({
    where: { sliceInstanceId: sliceInstance.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const classification = await db.sliceClassificationVersion.create({
    data: {
      projectId: image.projectId,
      imageId: image.id,
      sliceInstanceId: sliceInstance.id,
      version: (last?.version ?? 0) + 1,
      class: params.class,
      labelSchemaVersionId,
      createdById: params.userId,
    },
    select: { id: true, version: true, class: true },
  });

  await recordAuditEvent({
    action: "SLICE_CLASSIFICATION_COMMITTED",
    entity: "SliceClassificationVersion",
    entityId: classification.id,
    actorId: params.userId,
    details: {
      projectId: image.projectId,
      imageId: image.id,
      sliceInstanceId: sliceInstance.id,
      version: classification.version,
      class: classification.class,
    },
  }, db);

  return loadSliceStateForUser({ imageId: image.id, userId: params.userId }, db);
}

export function sliceErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof SliceWorkflowError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code.endsWith("_NOT_FOUND") || error.code === "IMAGE_NOT_FOUND"
          ? 404
          : 400;
    return { error: error.code, status };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { error: "SLICE_WORKFLOW_DB_ERROR", status: 500 };
  }

  return { error: "SLICE_WORKFLOW_FAILED", status: 500 };
}
