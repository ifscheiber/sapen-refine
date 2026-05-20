import { randomUUID } from "crypto";
import {
  AnnotationArtifactKind,
  AnnotationTaskStatus,
  AnnotationTaskType,
  ArtifactProvenance,
  PredictionTargetType,
  Prisma,
  PrismaClient,
  type AnnotationProjectRole,
} from "@prisma/client";

import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import { getObjectBytes, putObject, verifyStoredObject, deleteObjectBestEffort } from "@/server/storage/s3";
import {
  normalizeContentType,
  UploadIntegrityError,
  validateMaskBytes,
  validateSupportMaskValues,
} from "@/server/uploads/integrity";
import { validateUploadSize } from "@/server/uploads/validation";

type AssistedCorrectionDb = PrismaClient;

const WORK_ROLES = new Set<AnnotationProjectRole>(["OWNER", "QA", "LABELER"]);
const MANAGE_ROLES = new Set<AnnotationProjectRole>(["OWNER", "QA"]);
const SUPPORTED_TARGETS = new Set<PredictionTargetType>([
  PredictionTargetType.SEMANTIC_MASK,
  PredictionTargetType.SLICE_SUPPORT_MASK,
]);

const TASK_CONTEXT_SELECT = {
  id: true,
  projectId: true,
  imageId: true,
  sliceInstanceId: true,
  type: true,
  status: true,
  priority: true,
  taskReason: true,
  uncertaintyScore: true,
  confidenceScore: true,
  sourceArtifactVersionId: true,
  predictionRunId: true,
  predictionProvenanceId: true,
  assigneeId: true,
  image: {
    select: {
      id: true,
      projectId: true,
      filename: true,
      contentType: true,
      size: true,
      checksum: true,
      width: true,
      height: true,
    },
  },
  assignee: { select: { id: true, email: true, name: true } },
  predictionRun: {
    select: {
      id: true,
      status: true,
      inferenceRunId: true,
      generatedAt: true,
      modelRun: {
        select: {
          id: true,
          modelFamily: true,
          modelName: true,
          modelVersion: true,
          taskType: true,
          checkpointHash: true,
          configHash: true,
        },
      },
    },
  },
  predictionProvenance: {
    select: {
      id: true,
      artifactVersionId: true,
      targetType: true,
      predictedClass: true,
      confidenceScore: true,
      uncertaintyScore: true,
      modelOutputChecksum: true,
      createdAt: true,
    },
  },
} satisfies Prisma.AnnotationTaskSelect;

type TaskContextRecord = Prisma.AnnotationTaskGetPayload<{ select: typeof TASK_CONTEXT_SELECT }>;

type SourcePredictionVersion = {
  id: string;
  provenance: ArtifactProvenance;
  contentType: string | null;
  storageKey: string;
  size: number;
  checksum: string | null;
  width: number;
  height: number;
  format: string;
  createdAt: Date;
  artifact: {
    id: string;
    projectId: string;
    imageId: string;
    kind: AnnotationArtifactKind;
  };
};

export class AssistedCorrectionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    message = code,
  ) {
    super(message);
  }
}

function isManageRole(role: AnnotationProjectRole) {
  return MANAGE_ROLES.has(role);
}

function artifactKindForTarget(targetType: PredictionTargetType) {
  if (targetType === PredictionTargetType.SEMANTIC_MASK) return AnnotationArtifactKind.SEMANTIC_MASK;
  if (targetType === PredictionTargetType.SLICE_SUPPORT_MASK) return AnnotationArtifactKind.SLICE_SUPPORT_MASK;
  throw new AssistedCorrectionError("CORRECTION_TARGET_UNSUPPORTED", 400);
}

function modeForTarget(targetType: PredictionTargetType) {
  if (targetType === PredictionTargetType.SEMANTIC_MASK) return "semantic" as const;
  if (targetType === PredictionTargetType.SLICE_SUPPORT_MASK) return "support" as const;
  throw new AssistedCorrectionError("CORRECTION_TARGET_UNSUPPORTED", 400);
}

async function getMembership(db: AssistedCorrectionDb, projectId: string, userId: string) {
  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  if (!membership || !WORK_ROLES.has(membership.role)) {
    throw new AssistedCorrectionError("FORBIDDEN", 403);
  }
  return membership;
}

function assertCanWorkOnTask(task: TaskContextRecord, role: AnnotationProjectRole, userId: string) {
  if (task.type !== AnnotationTaskType.MODEL_PREDICTION_CORRECTION) {
    throw new AssistedCorrectionError("CORRECTION_TASK_NOT_FOUND", 404);
  }
  if (!task.imageId || !task.image) {
    throw new AssistedCorrectionError("CORRECTION_TASK_IMAGE_MISSING", 409);
  }
  if (!SUPPORTED_TARGETS.has(task.predictionProvenance?.targetType as PredictionTargetType)) {
    throw new AssistedCorrectionError("CORRECTION_TARGET_UNSUPPORTED", 400);
  }
  if (task.assigneeId && task.assigneeId !== userId && !isManageRole(role)) {
    throw new AssistedCorrectionError("FORBIDDEN", 403);
  }
}

async function loadTaskForUser(db: AssistedCorrectionDb, taskId: string, userId: string) {
  const task = await db.annotationTask.findUnique({
    where: { id: taskId },
    select: TASK_CONTEXT_SELECT,
  });
  if (!task) throw new AssistedCorrectionError("CORRECTION_TASK_NOT_FOUND", 404);

  const membership = await getMembership(db, task.projectId, userId);
  assertCanWorkOnTask(task, membership.role, userId);
  return { task, role: membership.role };
}

async function getSourcePredictionVersion(db: AssistedCorrectionDb, task: TaskContextRecord) {
  if (!task.sourceArtifactVersionId) {
    throw new AssistedCorrectionError("SOURCE_PREDICTION_MISSING", 409);
  }
  if (!task.predictionProvenance || task.predictionProvenance.artifactVersionId !== task.sourceArtifactVersionId) {
    throw new AssistedCorrectionError("SOURCE_PREDICTION_MISMATCH", 409);
  }

  const version = await db.annotationArtifactVersion.findUnique({
    where: { id: task.sourceArtifactVersionId },
    select: {
      id: true,
      provenance: true,
      contentType: true,
      storageKey: true,
      size: true,
      checksum: true,
      width: true,
      height: true,
      format: true,
      createdAt: true,
      artifact: {
        select: {
          id: true,
          projectId: true,
          imageId: true,
          kind: true,
        },
      },
    },
  });

  if (!version) throw new AssistedCorrectionError("SOURCE_PREDICTION_NOT_FOUND", 404);
  if (
    version.artifact.kind !== AnnotationArtifactKind.PREDICTION_MASK ||
    version.provenance !== ArtifactProvenance.MODEL_PREDICTION
  ) {
    throw new AssistedCorrectionError("SOURCE_ARTIFACT_NOT_PREDICTION", 409);
  }
  if (version.artifact.projectId !== task.projectId || version.artifact.imageId !== task.imageId) {
    throw new AssistedCorrectionError("SOURCE_PREDICTION_MISMATCH", 409);
  }
  return version;
}

async function getLabelSchemaVersionId(db: AssistedCorrectionDb, projectId: string) {
  const project = await db.annotationProject.findUnique({
    where: { id: projectId },
    select: { labelSchemaVersionId: true },
  });
  if (project?.labelSchemaVersionId) return project.labelSchemaVersionId;

  const fallback = await db.labelSchemaVersion.findFirst({
    where: { isDefault: true, status: "ACTIVE" },
    select: { id: true },
  });
  if (!fallback) throw new AssistedCorrectionError("DEFAULT_LABEL_SCHEMA_MISSING", 500);
  return fallback.id;
}

async function getSemanticMaskByteValues(db: AssistedCorrectionDb, labelSchemaVersionId: string) {
  const labels = await db.labelDefinition.findMany({
    where: {
      schemaVersionId: labelSchemaVersionId,
      applicability: "SEMANTIC_MASK",
      byteValue: { not: null },
    },
    select: { byteValue: true },
  });
  return new Set(labels.map((label) => label.byteValue).filter((value): value is number => value !== null));
}

async function getSliceSupportByteValue(db: AssistedCorrectionDb, labelSchemaVersionId: string) {
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
    throw new AssistedCorrectionError("SLICE_SUPPORT_LABEL_MISSING", 500);
  }
  return support.byteValue;
}

function validateSemanticMaskValues(bytes: Uint8Array, allowedValues: Set<number>) {
  if (allowedValues.size === 0) {
    throw new AssistedCorrectionError("SEMANTIC_MASK_VALUES_INVALID");
  }
  for (const value of bytes) {
    if (!allowedValues.has(value)) {
      throw new AssistedCorrectionError("SEMANTIC_MASK_VALUES_INVALID");
    }
  }
}

async function latestHumanVersion(db: AssistedCorrectionDb, params: {
  imageId: string;
  kind: AnnotationArtifactKind;
}) {
  const artifact = await db.annotationArtifact.findUnique({
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
  return db.annotationArtifactVersion.findFirst({
    where: { artifactId: artifact.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      reviewState: true,
      provenance: true,
      parentVersionId: true,
      taskId: true,
      checksum: true,
      width: true,
      height: true,
      format: true,
      createdAt: true,
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });
}

function sourceSummary(version: SourcePredictionVersion) {
  return {
    id: version.id,
    artifactId: version.artifact.id,
    provenance: version.provenance,
    size: version.size,
    checksum: version.checksum,
    width: version.width,
    height: version.height,
    format: version.format,
    contentType: version.contentType,
    createdAt: version.createdAt,
  };
}

function contextResponse(params: {
  task: TaskContextRecord;
  role: AnnotationProjectRole;
  sourceVersion: SourcePredictionVersion;
  latestHumanVersion: Awaited<ReturnType<typeof latestHumanVersion>>;
}) {
  const targetType = params.task.predictionProvenance!.targetType;
  const artifactKind = artifactKindForTarget(targetType);
  return {
    task: {
      id: params.task.id,
      projectId: params.task.projectId,
      imageId: params.task.imageId,
      status: params.task.status,
      priority: params.task.priority,
      taskReason: params.task.taskReason,
      confidenceScore: params.task.confidenceScore,
      uncertaintyScore: params.task.uncertaintyScore,
      assignee: params.task.assignee,
    },
    myRole: params.role,
    canEdit: true,
    mode: modeForTarget(targetType),
    targetType,
    humanArtifactKind: artifactKind,
    image: params.task.image,
    predictionRun: params.task.predictionRun,
    predictionProvenance: params.task.predictionProvenance,
    sourcePrediction: sourceSummary(params.sourceVersion),
    latestHumanVersion: params.latestHumanVersion,
    predictionMaskUrl: `/api/correction-tasks/${params.task.id}/prediction-mask`,
    correctionSaveUrl: `/api/correction-tasks/${params.task.id}/corrections`,
  };
}

export async function loadCorrectionContextForUser(params: {
  taskId: string;
  userId: string;
}, db: AssistedCorrectionDb = prisma) {
  const { task, role } = await loadTaskForUser(db, params.taskId, params.userId);
  const sourceVersion = await getSourcePredictionVersion(db, task);
  const targetType = task.predictionProvenance!.targetType;
  const humanVersion = await latestHumanVersion(db, {
    imageId: task.imageId!,
    kind: artifactKindForTarget(targetType),
  });
  return contextResponse({ task, role, sourceVersion, latestHumanVersion: humanVersion });
}

export async function readPredictionMaskForCorrectionTask(params: {
  taskId: string;
  userId: string;
}, db: AssistedCorrectionDb = prisma) {
  const { task } = await loadTaskForUser(db, params.taskId, params.userId);
  const sourceVersion = await getSourcePredictionVersion(db, task);
  const bytes = await getObjectBytes(sourceVersion.storageKey);
  return {
    bytes,
    contentType: sourceVersion.contentType ?? "application/octet-stream",
    format: sourceVersion.format,
    checksum: sourceVersion.checksum,
  };
}

export async function saveCorrectionForTaskForUser(params: {
  taskId: string;
  userId: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  contentType?: string | null;
  format?: string | null;
  expectedChecksum?: string | null;
}, db: AssistedCorrectionDb = prisma) {
  const { task, role } = await loadTaskForUser(db, params.taskId, params.userId);
  const sourceVersion = await getSourcePredictionVersion(db, task);
  const targetType = task.predictionProvenance!.targetType;
  const kind = artifactKindForTarget(targetType);
  const image = task.image!;

  const sizeValidation = validateUploadSize(params.bytes.byteLength, "mask");
  if (!sizeValidation.ok) {
    throw new AssistedCorrectionError(sizeValidation.error, sizeValidation.status);
  }

  const contentType = normalizeContentType(params.contentType);
  const integrity = validateMaskBytes({
    bytes: params.bytes,
    width: params.width,
    height: params.height,
    imageWidth: image.width,
    imageHeight: image.height,
    format: params.format,
    expectedChecksum: params.expectedChecksum,
  });

  const labelSchemaVersionId = await getLabelSchemaVersionId(db, task.projectId);
  if (targetType === PredictionTargetType.SEMANTIC_MASK) {
    const allowed = await getSemanticMaskByteValues(db, labelSchemaVersionId);
    validateSemanticMaskValues(params.bytes, allowed);
  } else {
    const supportByte = await getSliceSupportByteValue(db, labelSchemaVersionId);
    validateSupportMaskValues(params.bytes, supportByte);
  }

  const storageKey = `projects/${task.projectId}/corrections/${task.id}/${randomUUID()}.msk`;
  let objectWritten = false;
  try {
    await putObject(storageKey, params.bytes, contentType);
    objectWritten = true;
    await verifyStoredObject({ key: storageKey, size: integrity.size, contentType });

    const result = await db.$transaction(async (tx) => {
      const artifact = await tx.annotationArtifact.upsert({
        where: {
          imageId_kind_scopeKey: {
            imageId: image.id,
            kind,
            scopeKey: "default",
          },
        },
        update: {},
        create: {
          projectId: task.projectId,
          imageId: image.id,
          kind,
          scopeKey: "default",
          createdById: params.userId,
        },
        select: { id: true },
      });

      const last = await tx.annotationArtifactVersion.findFirst({
        where: { artifactId: artifact.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const version = await tx.annotationArtifactVersion.create({
        data: {
          artifactId: artifact.id,
          version: (last?.version ?? 0) + 1,
          reviewState: "DRAFT",
          provenance: ArtifactProvenance.HUMAN_CORRECTION,
          storageKey,
          contentType,
          size: integrity.size,
          checksum: integrity.checksum,
          width: integrity.width,
          height: integrity.height,
          format: integrity.format,
          labelSchemaVersionId,
          parentVersionId: sourceVersion.id,
          taskId: task.id,
          createdById: params.userId,
        },
        select: {
          id: true,
          version: true,
          reviewState: true,
          provenance: true,
          parentVersionId: true,
          taskId: true,
          checksum: true,
          width: true,
          height: true,
          format: true,
          createdAt: true,
        },
      });

      if (kind === AnnotationArtifactKind.SLICE_SUPPORT_MASK) {
        const slice =
          (await tx.sliceInstance.findFirst({
            where: { projectId: task.projectId, imageId: image.id },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          })) ??
          (await tx.sliceInstance.create({
            data: {
              projectId: task.projectId,
              imageId: image.id,
              createdById: params.userId,
            },
            select: { id: true },
          }));
        await tx.sliceInstance.update({
          where: { id: slice.id },
          data: { supportArtifactVersionId: version.id },
        });
      }

      const updatedTask = await tx.annotationTask.update({
        where: { id: task.id },
        data: {
          status:
            task.status === AnnotationTaskStatus.OPEN || task.status === AnnotationTaskStatus.BLOCKED
              ? AnnotationTaskStatus.IN_PROGRESS
              : task.status,
          assigneeId: task.assigneeId ?? params.userId,
        },
        select: {
          id: true,
          status: true,
          assigneeId: true,
          updatedAt: true,
        },
      });

      return {
        artifactId: artifact.id,
        artifactKind: kind,
        version,
        task: updatedTask,
      };
    });

    await recordAuditEvent({
      action: "HUMAN_CORRECTION_COMMITTED",
      entity: "AnnotationArtifactVersion",
      entityId: result.version.id,
      actorId: params.userId,
      details: {
        projectId: task.projectId,
        imageId: image.id,
        taskId: task.id,
        artifactId: result.artifactId,
        artifactKind: kind,
        sourcePredictionArtifactVersionId: sourceVersion.id,
        predictionRunId: task.predictionRunId,
        predictionProvenanceId: task.predictionProvenanceId,
        checksum: integrity.checksum,
        size: integrity.size,
        width: integrity.width,
        height: integrity.height,
        role,
      },
    });

    return result;
  } catch (error) {
    if (objectWritten) await deleteObjectBestEffort(storageKey);
    if (error instanceof AssistedCorrectionError || error instanceof UploadIntegrityError) throw error;
    if (error instanceof Error && error.message.startsWith("OBJECT_STAT")) {
      throw new AssistedCorrectionError("OBJECT_STAT_FAILED", 500);
    }
    throw new AssistedCorrectionError(objectWritten ? "OBJECT_STAT_FAILED" : "OBJECT_WRITE_FAILED", 500);
  }
}

export function assistedCorrectionErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof AssistedCorrectionError) {
    return { error: error.code, status: error.status };
  }
  if (error instanceof UploadIntegrityError) {
    return { error: error.code, status: error.status };
  }
  return { error: "ASSISTED_CORRECTION_FAILED", status: 500 };
}
