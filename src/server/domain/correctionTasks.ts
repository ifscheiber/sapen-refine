import {
  AnnotationTaskStatus,
  AnnotationTaskType,
  PredictionTargetType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import {
  canManageCorrectionTasks,
  canReadProject,
  canWorkOnCorrectionTask,
} from "@/server/auth/policies";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";

type CorrectionTaskDb = PrismaClient;

const ACTIVE_STATUSES = new Set<AnnotationTaskStatus>([
  AnnotationTaskStatus.OPEN,
  AnnotationTaskStatus.IN_PROGRESS,
  AnnotationTaskStatus.SUBMITTED,
  AnnotationTaskStatus.BLOCKED,
]);

export const CORRECTION_TASK_REASONS = [
  "LOW_CONFIDENCE",
  "HIGH_UNCERTAINTY",
  "MISSING_GROUND_TRUTH",
  "MANUAL_PRIORITY",
] as const;

type CorrectionTaskReason = (typeof CORRECTION_TASK_REASONS)[number];

const REASON_SET = new Set<string>(CORRECTION_TASK_REASONS);
const TASK_SELECT = {
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
  modelSource: true,
  sourceArtifactVersionId: true,
  predictionRunId: true,
  predictionProvenanceId: true,
  createdById: true,
  assigneeId: true,
  createdAt: true,
  updatedAt: true,
  image: {
    select: {
      id: true,
      filename: true,
      width: true,
      height: true,
      checksum: true,
    },
  },
  sliceInstance: { select: { id: true } },
  createdBy: { select: { id: true, email: true, name: true } },
  assignee: { select: { id: true, email: true, name: true } },
  predictionRun: {
    select: {
      id: true,
      projectId: true,
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
      targetType: true,
      predictedClass: true,
      confidenceScore: true,
      uncertaintyScore: true,
      modelOutputChecksum: true,
      createdAt: true,
    },
  },
} satisfies Prisma.AnnotationTaskSelect;

type SelectedCorrectionTask = Prisma.AnnotationTaskGetPayload<{ select: typeof TASK_SELECT }>;

export class CorrectionTaskError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    message = code,
  ) {
    super(message);
  }
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseReason(value: unknown) {
  const reason = cleanText(value);
  if (!reason) return null;
  if (!REASON_SET.has(reason)) throw new CorrectionTaskError("INVALID_TASK_REASON");
  return reason as CorrectionTaskReason;
}

function parsePriority(value: unknown, code = "INVALID_TASK_PRIORITY") {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new CorrectionTaskError(code);
  }
  return parsed;
}

function parseStatus(value: unknown) {
  const status = cleanText(value);
  if (!status) return null;
  if (!Object.values(AnnotationTaskStatus).includes(status as AnnotationTaskStatus)) {
    throw new CorrectionTaskError("INVALID_TASK_STATUS");
  }
  return status as AnnotationTaskStatus;
}

function parseTargetType(value: unknown) {
  const targetType = cleanText(value);
  if (!targetType) return null;
  if (!Object.values(PredictionTargetType).includes(targetType as PredictionTargetType)) {
    throw new CorrectionTaskError("INVALID_PREDICTION_TARGET_TYPE");
  }
  return targetType as PredictionTargetType;
}

function parseScope(value: unknown) {
  const scope = cleanText(value);
  if (!scope) return "active";
  if (!["active", "mine", "all"].includes(scope)) throw new CorrectionTaskError("INVALID_TASK_SCOPE");
  return scope as "active" | "mine" | "all";
}

function deriveReason(params: { confidenceScore: number | null; uncertaintyScore: number | null }) {
  if (params.uncertaintyScore !== null && params.uncertaintyScore >= 0.5) return "HIGH_UNCERTAINTY";
  if (params.confidenceScore !== null && params.confidenceScore <= 0.5) return "LOW_CONFIDENCE";
  return "MISSING_GROUND_TRUTH";
}

function derivePriority(params: {
  reason: CorrectionTaskReason;
  confidenceScore: number | null;
  uncertaintyScore: number | null;
}) {
  if (params.reason === "MANUAL_PRIORITY") return 80;
  if (params.reason === "HIGH_UNCERTAINTY") return 70;
  if (params.reason === "LOW_CONFIDENCE") return 60;
  return 50;
}

async function getProjectMembership(db: CorrectionTaskDb, projectId: string, userId: string) {
  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  if (!membership || !canReadProject(membership.role)) {
    throw new CorrectionTaskError("FORBIDDEN", 403);
  }
  return membership;
}

async function requireAssignableMember(db: CorrectionTaskDb, projectId: string, userId: string) {
  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  if (!membership || !canWorkOnCorrectionTask(membership.role)) {
    throw new CorrectionTaskError("ASSIGNEE_NOT_PROJECT_MEMBER");
  }
}

function modelSourceFromRun(task: {
  predictionRun?: {
    modelRun?: {
      modelFamily: string;
      modelName: string;
      modelVersion: string | null;
    } | null;
  } | null;
}) {
  const modelRun = task.predictionRun?.modelRun;
  if (!modelRun) return null;
  return [modelRun.modelFamily, modelRun.modelName, modelRun.modelVersion].filter(Boolean).join("/");
}

function serializeTask(task: SelectedCorrectionTask) {
  const editorHref = task.imageId
    ? `/app/projects/${task.projectId}/tasks/${task.id}/correct`
    : null;

  return {
    id: task.id,
    projectId: task.projectId,
    imageId: task.imageId,
    sliceInstanceId: task.sliceInstanceId,
    type: task.type,
    status: task.status,
    priority: task.priority,
    taskReason: task.taskReason,
    uncertaintyScore: task.uncertaintyScore,
    confidenceScore: task.confidenceScore,
    modelSource: task.modelSource ?? modelSourceFromRun(task),
    sourceArtifactVersionId: task.sourceArtifactVersionId,
    predictionRunId: task.predictionRunId,
    predictionProvenanceId: task.predictionProvenanceId,
    createdById: task.createdById,
    assigneeId: task.assigneeId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    editorHref,
    image: task.image,
    sliceInstance: task.sliceInstance,
    createdBy: task.createdBy,
    assignee: task.assignee,
    predictionRun: task.predictionRun,
    predictionProvenance: task.predictionProvenance,
  };
}

function sortTasks(a: SelectedCorrectionTask, b: SelectedCorrectionTask) {
  const priority = b.priority - a.priority;
  if (priority !== 0) return priority;

  const uncertaintyA = a.uncertaintyScore ?? Number.NEGATIVE_INFINITY;
  const uncertaintyB = b.uncertaintyScore ?? Number.NEGATIVE_INFINITY;
  if (uncertaintyA !== uncertaintyB) return uncertaintyB - uncertaintyA;

  const confidenceA = a.confidenceScore ?? Number.POSITIVE_INFINITY;
  const confidenceB = b.confidenceScore ?? Number.POSITIVE_INFINITY;
  if (confidenceA !== confidenceB) return confidenceA - confidenceB;

  const created = a.createdAt.getTime() - b.createdAt.getTime();
  if (created !== 0) return created;
  return a.id.localeCompare(b.id);
}

function parseCreateInput(input: unknown) {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return {
    reason: parseReason(body.reason),
    defaultPriority: parsePriority(body.defaultPriority),
    assigneeId: cleanText(body.assigneeId),
  };
}

function parseUpdateInput(input: unknown) {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const action = cleanText(body.action);
  if (!action) throw new CorrectionTaskError("INVALID_TASK_ACTION");
  if (!["assign_to_me", "assign", "start", "dismiss", "set_priority"].includes(action)) {
    throw new CorrectionTaskError("INVALID_TASK_ACTION");
  }
  return {
    action: action as "assign_to_me" | "assign" | "start" | "dismiss" | "set_priority",
    assigneeId: cleanText(body.assigneeId),
    priority: parsePriority(body.priority),
  };
}

function assertActiveTask(task: SelectedCorrectionTask) {
  if (!ACTIVE_STATUSES.has(task.status)) {
    throw new CorrectionTaskError("INVALID_TASK_STATUS_TRANSITION", 409);
  }
}

export async function createCorrectionTasksForPredictionRunForUser(params: {
  predictionRunId: string;
  userId: string;
  input?: unknown;
}, db: CorrectionTaskDb = prisma) {
  const input = parseCreateInput(params.input);
  const predictionRun = await db.predictionRun.findUnique({
    where: { id: params.predictionRunId },
    select: {
      id: true,
      projectId: true,
      modelRun: {
        select: {
          modelFamily: true,
          modelName: true,
          modelVersion: true,
        },
      },
    },
  });
  if (!predictionRun) throw new CorrectionTaskError("PREDICTION_RUN_NOT_FOUND", 404);

  const membership = await getProjectMembership(db, predictionRun.projectId, params.userId);
  if (!canManageCorrectionTasks(membership.role)) throw new CorrectionTaskError("FORBIDDEN", 403);
  if (input.assigneeId) {
    await requireAssignableMember(db, predictionRun.projectId, input.assigneeId);
  }

  const provenances = await db.predictionArtifactProvenance.findMany({
    where: { predictionRunId: predictionRun.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      imageId: true,
      sliceInstanceId: true,
      artifactVersionId: true,
      targetType: true,
      confidenceScore: true,
      uncertaintyScore: true,
    },
  });

  if (provenances.length === 0) {
    return {
      predictionRunId: predictionRun.id,
      projectId: predictionRun.projectId,
      createdCount: 0,
      skippedExistingCount: 0,
      tasks: [],
    };
  }

  const existing = await db.annotationTask.findMany({
    where: {
      type: AnnotationTaskType.MODEL_PREDICTION_CORRECTION,
      predictionProvenanceId: { in: provenances.map((item) => item.id) },
    },
    select: { predictionProvenanceId: true },
  });
  const existingIds = new Set(existing.map((task) => task.predictionProvenanceId).filter(Boolean));
  const createdTasks: SelectedCorrectionTask[] = [];

  await db.$transaction(async (tx) => {
    for (const provenance of provenances) {
      if (existingIds.has(provenance.id)) continue;
      const reason = input.reason ?? deriveReason({
        confidenceScore: provenance.confidenceScore,
        uncertaintyScore: provenance.uncertaintyScore,
      });
      const task = await tx.annotationTask.create({
        data: {
          projectId: predictionRun.projectId,
          imageId: provenance.imageId,
          sliceInstanceId: provenance.sliceInstanceId,
          type: AnnotationTaskType.MODEL_PREDICTION_CORRECTION,
          status: AnnotationTaskStatus.OPEN,
          priority: input.defaultPriority ?? derivePriority({
            reason,
            confidenceScore: provenance.confidenceScore,
            uncertaintyScore: provenance.uncertaintyScore,
          }),
          taskReason: reason,
          confidenceScore: provenance.confidenceScore,
          uncertaintyScore: provenance.uncertaintyScore,
          modelSource: modelSourceFromRun({ predictionRun }),
          sourceArtifactVersionId: provenance.artifactVersionId,
          predictionRunId: predictionRun.id,
          predictionProvenanceId: provenance.id,
          createdById: params.userId,
          assigneeId: input.assigneeId,
        },
        select: TASK_SELECT,
      });
      createdTasks.push(task);
    }
  });

  await recordAuditEvent({
    action: "CORRECTION_TASKS_CREATED",
    entity: "PredictionRun",
    entityId: predictionRun.id,
    actorId: params.userId,
    details: {
      projectId: predictionRun.projectId,
      createdCount: createdTasks.length,
      skippedExistingCount: provenances.length - createdTasks.length,
    },
  });

  return {
    predictionRunId: predictionRun.id,
    projectId: predictionRun.projectId,
    createdCount: createdTasks.length,
    skippedExistingCount: provenances.length - createdTasks.length,
    tasks: createdTasks.sort(sortTasks).map(serializeTask),
  };
}

export async function listProjectCorrectionTasksForUser(params: {
  projectId: string;
  userId: string;
  scope?: unknown;
  status?: unknown;
  targetType?: unknown;
  reason?: unknown;
  predictionRunId?: unknown;
}, db: CorrectionTaskDb = prisma) {
  await getProjectMembership(db, params.projectId, params.userId);
  const scope = parseScope(params.scope);
  const status = parseStatus(params.status);
  const targetType = parseTargetType(params.targetType);
  const reason = parseReason(params.reason);
  const predictionRunId = cleanText(params.predictionRunId);

  const where: Prisma.AnnotationTaskWhereInput = {
    projectId: params.projectId,
    type: AnnotationTaskType.MODEL_PREDICTION_CORRECTION,
    ...(status ? { status } : scope === "active" ? { status: { notIn: ["DONE", "CANCELLED"] } } : {}),
    ...(scope === "mine" ? { assigneeId: params.userId } : {}),
    ...(reason ? { taskReason: reason } : {}),
    ...(predictionRunId ? { predictionRunId } : {}),
    ...(targetType ? { predictionProvenance: { targetType } } : {}),
  };

  const tasks = await db.annotationTask.findMany({
    where,
    select: TASK_SELECT,
  });

  return {
    projectId: params.projectId,
    tasks: tasks.sort(sortTasks).map(serializeTask),
  };
}

export async function getCorrectionTaskForUser(params: {
  taskId: string;
  userId: string;
}, db: CorrectionTaskDb = prisma) {
  const task = await db.annotationTask.findUnique({
    where: { id: params.taskId },
    select: TASK_SELECT,
  });
  if (!task || task.type !== AnnotationTaskType.MODEL_PREDICTION_CORRECTION) {
    throw new CorrectionTaskError("CORRECTION_TASK_NOT_FOUND", 404);
  }
  await getProjectMembership(db, task.projectId, params.userId);
  return serializeTask(task);
}

export async function updateCorrectionTaskForUser(params: {
  taskId: string;
  userId: string;
  input: unknown;
}, db: CorrectionTaskDb = prisma) {
  const input = parseUpdateInput(params.input);
  const task = await db.annotationTask.findUnique({
    where: { id: params.taskId },
    select: TASK_SELECT,
  });
  if (!task || task.type !== AnnotationTaskType.MODEL_PREDICTION_CORRECTION) {
    throw new CorrectionTaskError("CORRECTION_TASK_NOT_FOUND", 404);
  }

  const membership = await getProjectMembership(db, task.projectId, params.userId);
  if (!canWorkOnCorrectionTask(membership.role)) throw new CorrectionTaskError("FORBIDDEN", 403);
  assertActiveTask(task);

  const canManage = canManageCorrectionTasks(membership.role);
  const data: Prisma.AnnotationTaskUpdateInput = {};

  if (input.action === "assign_to_me") {
    if (!canManage && task.assigneeId && task.assigneeId !== params.userId) {
      throw new CorrectionTaskError("FORBIDDEN", 403);
    }
    data.assignee = { connect: { id: params.userId } };
  }

  if (input.action === "assign") {
    if (!canManage) throw new CorrectionTaskError("FORBIDDEN", 403);
    if (!input.assigneeId) throw new CorrectionTaskError("ASSIGNEE_REQUIRED");
    await requireAssignableMember(db, task.projectId, input.assigneeId);
    data.assignee = { connect: { id: input.assigneeId } };
  }

  if (input.action === "start") {
    if (!canManage && task.assigneeId && task.assigneeId !== params.userId) {
      throw new CorrectionTaskError("FORBIDDEN", 403);
    }
    data.status = AnnotationTaskStatus.IN_PROGRESS;
    if (!task.assigneeId) data.assignee = { connect: { id: params.userId } };
  }

  if (input.action === "dismiss") {
    if (!canManage && task.assigneeId !== params.userId) {
      throw new CorrectionTaskError("FORBIDDEN", 403);
    }
    data.status = AnnotationTaskStatus.CANCELLED;
  }

  if (input.action === "set_priority") {
    if (!canManage) throw new CorrectionTaskError("FORBIDDEN", 403);
    if (input.priority === null) throw new CorrectionTaskError("INVALID_TASK_PRIORITY");
    data.priority = input.priority;
  }

  const updated = await db.annotationTask.update({
    where: { id: task.id },
    data,
    select: TASK_SELECT,
  });

  await recordAuditEvent({
    action: "CORRECTION_TASK_UPDATED",
    entity: "AnnotationTask",
    entityId: task.id,
    actorId: params.userId,
    details: {
      projectId: task.projectId,
      action: input.action,
      previousStatus: task.status,
      status: updated.status,
      assigneeId: updated.assigneeId,
      priority: updated.priority,
    },
  });

  return serializeTask(updated);
}

export function correctionTaskErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof CorrectionTaskError) {
    return { error: error.code, status: error.status };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { error: "CORRECTION_TASK_ALREADY_EXISTS", status: 409 };
  }
  return { error: "CORRECTION_TASK_FAILED", status: 500 };
}
