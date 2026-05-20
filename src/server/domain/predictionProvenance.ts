import {
  AnnotationArtifactKind,
  ArtifactProvenance,
  ModelTaskType,
  PredictionRunStatus,
  PredictionTargetType,
  Prisma,
  PrismaClient,
  SliceClass,
  type AnnotationProjectRole,
} from "@prisma/client";

import { prisma } from "@/server/db";

type ProvenanceDb = PrismaClient | Prisma.TransactionClient;

const MODEL_TASK_TYPES = new Set<ModelTaskType>(Object.values(ModelTaskType));
const PREDICTION_RUN_STATUSES = new Set<PredictionRunStatus>(Object.values(PredictionRunStatus));
const PREDICTION_TARGET_TYPES = new Set<PredictionTargetType>(Object.values(PredictionTargetType));
const SLICE_CLASSES = new Set<SliceClass>(Object.values(SliceClass));
const PREDICTION_RUN_CREATE_ROLES = new Set<AnnotationProjectRole>(["OWNER", "QA"]);

export class PredictionProvenanceError extends Error {
  constructor(
    public readonly code: string,
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

function requiredText(value: unknown, code: string) {
  const text = cleanText(value);
  if (!text) throw new PredictionProvenanceError(code);
  return text;
}

function optionalJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : value as Prisma.InputJsonValue;
}

function optionalDate(value: unknown, code: string) {
  if (value === undefined || value === null || value === "") return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string") throw new PredictionProvenanceError(code);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new PredictionProvenanceError(code);
  return parsed;
}

function optionalNonNegativeInteger(value: unknown, code: string) {
  if (value === undefined || value === null || value === "") return null;
  if (!Number.isInteger(value) || Number(value) < 0) throw new PredictionProvenanceError(code);
  return Number(value);
}

function optionalScore(value: unknown, code: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new PredictionProvenanceError(code);
  }
  return value;
}

function parseModelTaskType(value: unknown) {
  if (typeof value !== "string" || !MODEL_TASK_TYPES.has(value as ModelTaskType)) {
    throw new PredictionProvenanceError("INVALID_MODEL_TASK_TYPE");
  }
  return value as ModelTaskType;
}

function parsePredictionRunStatus(value: unknown) {
  if (value === undefined || value === null || value === "") return PredictionRunStatus.CREATED;
  if (typeof value !== "string" || !PREDICTION_RUN_STATUSES.has(value as PredictionRunStatus)) {
    throw new PredictionProvenanceError("INVALID_PREDICTION_RUN_STATUS");
  }
  return value as PredictionRunStatus;
}

function parsePredictionTargetType(value: unknown) {
  if (typeof value !== "string" || !PREDICTION_TARGET_TYPES.has(value as PredictionTargetType)) {
    throw new PredictionProvenanceError("INVALID_PREDICTION_TARGET_TYPE");
  }
  return value as PredictionTargetType;
}

function parseSliceClass(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !SLICE_CLASSES.has(value as SliceClass)) {
    throw new PredictionProvenanceError("INVALID_PREDICTED_CLASS");
  }
  return value as SliceClass;
}

async function hasGlobalRole(db: ProvenanceDb, userId: string, roleName: "ADMIN" | "USER") {
  const role = await db.userGlobalRole.findFirst({
    where: { userId, role: { name: roleName } },
    select: { userId: true },
  });
  return Boolean(role);
}

async function requireAdmin(db: ProvenanceDb, userId: string) {
  if (!(await hasGlobalRole(db, userId, "ADMIN"))) throw new PredictionProvenanceError("FORBIDDEN");
}

async function getProjectMembership(db: ProvenanceDb, projectId: string, userId: string) {
  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  if (!membership) throw new PredictionProvenanceError("FORBIDDEN");
  return membership;
}

function canCreatePredictionRun(role: AnnotationProjectRole) {
  return PREDICTION_RUN_CREATE_ROLES.has(role);
}

export function parseCreateModelRunInput(input: unknown): Prisma.ModelRunCreateInput {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const modelFamily = requiredText(body.modelFamily, "MODEL_FAMILY_REQUIRED");
  const modelName = requiredText(body.modelName, "MODEL_NAME_REQUIRED");
  const taskType = parseModelTaskType(body.taskType);

  return {
    modelFamily,
    modelName,
    taskType,
    modelVersion: cleanText(body.modelVersion),
    checkpointId: cleanText(body.checkpointId),
    checkpointPath: cleanText(body.checkpointPath),
    checkpointHash: cleanText(body.checkpointHash),
    trainingRunId: cleanText(body.trainingRunId),
    trainingDatasetRef: cleanText(body.trainingDatasetRef),
    trainingCodeVersion: cleanText(body.trainingCodeVersion),
    trainingGitCommit: cleanText(body.trainingGitCommit),
    configHash: cleanText(body.configHash),
    notes: cleanText(body.notes),
    warnings: optionalJson(body.warnings),
    metadata: optionalJson(body.metadata),
    ...(cleanText(body.trainingExportBatchId)
      ? { trainingExportBatch: { connect: { id: cleanText(body.trainingExportBatchId)! } } }
      : {}),
  };
}

export function parseCreatePredictionRunInput(input: unknown): Omit<Prisma.PredictionRunCreateInput, "modelRun" | "project" | "generatedBy"> & {
  modelRunId: string;
  sourceExportBatchId: string | null;
} {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return {
    modelRunId: requiredText(body.modelRunId, "MODEL_RUN_ID_REQUIRED"),
    sourceExportBatchId: cleanText(body.sourceExportBatchId),
    sourceDatasetRef: cleanText(body.sourceDatasetRef),
    selectionCriteria: optionalJson(body.selectionCriteria),
    inferenceRunId: cleanText(body.inferenceRunId),
    generatedAt: optionalDate(body.generatedAt, "GENERATED_AT_INVALID"),
    status: parsePredictionRunStatus(body.status),
    inputImageCount: optionalNonNegativeInteger(body.inputImageCount, "INPUT_IMAGE_COUNT_INVALID"),
    outputPredictionCount: optionalNonNegativeInteger(body.outputPredictionCount, "OUTPUT_PREDICTION_COUNT_INVALID"),
    aggregateConfidenceSummary: optionalJson(body.aggregateConfidenceSummary),
    aggregateUncertaintySummary: optionalJson(body.aggregateUncertaintySummary),
    configHash: cleanText(body.configHash),
    notes: cleanText(body.notes),
    warnings: optionalJson(body.warnings),
    metadata: optionalJson(body.metadata),
  };
}

export function parseCreatePredictionProvenanceInput(input: unknown) {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const targetType = parsePredictionTargetType(body.targetType);
  const predictedClass = parseSliceClass(body.predictedClass);

  if (targetType === PredictionTargetType.SLICE_CLASSIFICATION && !predictedClass) {
    throw new PredictionProvenanceError("PREDICTED_CLASS_REQUIRED");
  }
  if (targetType !== PredictionTargetType.SLICE_CLASSIFICATION && predictedClass) {
    throw new PredictionProvenanceError("PREDICTED_CLASS_TARGET_INVALID");
  }

  return {
    predictionRunId: requiredText(body.predictionRunId, "PREDICTION_RUN_ID_REQUIRED"),
    imageId: requiredText(body.imageId, "IMAGE_ID_REQUIRED"),
    artifactVersionId: cleanText(body.artifactVersionId),
    sliceInstanceId: cleanText(body.sliceInstanceId),
    targetType,
    predictedClass,
    confidenceScore: optionalScore(body.confidenceScore, "CONFIDENCE_OUT_OF_RANGE"),
    uncertaintyScore: optionalScore(body.uncertaintyScore, "UNCERTAINTY_OUT_OF_RANGE"),
    perClassScores: optionalJson(body.perClassScores),
    outputStats: optionalJson(body.outputStats),
    modelOutputChecksum: cleanText(body.modelOutputChecksum),
  };
}

const MODEL_RUN_SELECT = {
  id: true,
  modelFamily: true,
  modelName: true,
  modelVersion: true,
  taskType: true,
  checkpointId: true,
  checkpointPath: true,
  checkpointHash: true,
  trainingRunId: true,
  trainingDatasetRef: true,
  trainingExportBatchId: true,
  trainingCodeVersion: true,
  trainingGitCommit: true,
  configHash: true,
  createdBy: { select: { id: true, email: true, name: true } },
  notes: true,
  warnings: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ModelRunSelect;

const PREDICTION_RUN_SELECT = {
  id: true,
  modelRunId: true,
  projectId: true,
  sourceExportBatchId: true,
  sourceDatasetRef: true,
  selectionCriteria: true,
  inferenceRunId: true,
  generatedBy: { select: { id: true, email: true, name: true } },
  generatedAt: true,
  status: true,
  inputImageCount: true,
  outputPredictionCount: true,
  aggregateConfidenceSummary: true,
  aggregateUncertaintySummary: true,
  configHash: true,
  notes: true,
  warnings: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
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
  _count: { select: { predictions: true, tasks: true } },
} satisfies Prisma.PredictionRunSelect;

const PREDICTION_PROVENANCE_SELECT = {
  id: true,
  predictionRunId: true,
  artifactVersionId: true,
  imageId: true,
  sliceInstanceId: true,
  targetType: true,
  predictedClass: true,
  confidenceScore: true,
  uncertaintyScore: true,
  perClassScores: true,
  outputStats: true,
  modelOutputChecksum: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PredictionArtifactProvenanceSelect;

export async function createModelRunForUser(params: {
  userId: string;
  input: unknown;
}, db: ProvenanceDb = prisma) {
  await requireAdmin(db, params.userId);
  const data = parseCreateModelRunInput(params.input);
  const modelRun = await db.modelRun.create({
    data: {
      ...data,
      createdBy: { connect: { id: params.userId } },
    },
    select: MODEL_RUN_SELECT,
  });
  return modelRun;
}

export async function getModelRunForUser(params: {
  modelRunId: string;
  userId: string;
}, db: ProvenanceDb = prisma) {
  await requireAdmin(db, params.userId);
  const modelRun = await db.modelRun.findUnique({
    where: { id: params.modelRunId },
    select: MODEL_RUN_SELECT,
  });
  if (!modelRun) throw new PredictionProvenanceError("MODEL_RUN_NOT_FOUND");
  return modelRun;
}

export async function createPredictionRunForUser(params: {
  projectId: string;
  userId: string;
  input: unknown;
}, db: ProvenanceDb = prisma) {
  const membership = await getProjectMembership(db, params.projectId, params.userId);
  if (!canCreatePredictionRun(membership.role)) throw new PredictionProvenanceError("FORBIDDEN");

  const input = parseCreatePredictionRunInput(params.input);
  const modelRun = await db.modelRun.findUnique({ where: { id: input.modelRunId }, select: { id: true } });
  if (!modelRun) throw new PredictionProvenanceError("MODEL_RUN_NOT_FOUND");

  if (input.sourceExportBatchId) {
    const sourceExport = await db.exportBatch.findUnique({
      where: { id: input.sourceExportBatchId },
      select: { projectId: true },
    });
    if (!sourceExport) throw new PredictionProvenanceError("SOURCE_EXPORT_NOT_FOUND");
    if (sourceExport.projectId !== params.projectId) throw new PredictionProvenanceError("PROJECT_MISMATCH");
  }

  try {
    return await db.predictionRun.create({
      data: {
        modelRun: { connect: { id: input.modelRunId } },
        project: { connect: { id: params.projectId } },
        generatedBy: { connect: { id: params.userId } },
        ...(input.sourceExportBatchId
          ? { sourceExportBatch: { connect: { id: input.sourceExportBatchId } } }
          : {}),
        sourceDatasetRef: input.sourceDatasetRef,
        selectionCriteria: input.selectionCriteria,
        inferenceRunId: input.inferenceRunId,
        generatedAt: input.generatedAt,
        status: input.status,
        inputImageCount: input.inputImageCount,
        outputPredictionCount: input.outputPredictionCount,
        aggregateConfidenceSummary: input.aggregateConfidenceSummary,
        aggregateUncertaintySummary: input.aggregateUncertaintySummary,
        configHash: input.configHash,
        notes: input.notes,
        warnings: input.warnings,
        metadata: input.metadata,
      },
      select: PREDICTION_RUN_SELECT,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PredictionProvenanceError("DUPLICATE_INFERENCE_RUN");
    }
    throw error;
  }
}

export async function listProjectPredictionRunsForUser(params: {
  projectId: string;
  userId: string;
}, db: ProvenanceDb = prisma) {
  await getProjectMembership(db, params.projectId, params.userId);
  return db.predictionRun.findMany({
    where: { projectId: params.projectId },
    orderBy: { generatedAt: "desc" },
    select: PREDICTION_RUN_SELECT,
  });
}

export async function getPredictionRunForUser(params: {
  predictionRunId: string;
  userId: string;
}, db: ProvenanceDb = prisma) {
  const predictionRun = await db.predictionRun.findUnique({
    where: { id: params.predictionRunId },
    select: PREDICTION_RUN_SELECT,
  });
  if (!predictionRun) throw new PredictionProvenanceError("PREDICTION_RUN_NOT_FOUND");
  await getProjectMembership(db, predictionRun.projectId, params.userId);
  return predictionRun;
}

export async function createPredictionArtifactProvenance(params: {
  input: unknown;
}, db: ProvenanceDb = prisma) {
  const input = parseCreatePredictionProvenanceInput(params.input);
  const predictionRun = await db.predictionRun.findUnique({
    where: { id: input.predictionRunId },
    select: { id: true, projectId: true },
  });
  if (!predictionRun) throw new PredictionProvenanceError("PREDICTION_RUN_NOT_FOUND");

  const image = await db.imageAsset.findUnique({
    where: { id: input.imageId },
    select: { id: true, projectId: true },
  });
  if (!image) throw new PredictionProvenanceError("IMAGE_NOT_FOUND");
  if (image.projectId !== predictionRun.projectId) throw new PredictionProvenanceError("PROJECT_MISMATCH");

  if (input.sliceInstanceId) {
    const sliceInstance = await db.sliceInstance.findUnique({
      where: { id: input.sliceInstanceId },
      select: { projectId: true, imageId: true },
    });
    if (!sliceInstance) throw new PredictionProvenanceError("SLICE_INSTANCE_NOT_FOUND");
    if (sliceInstance.projectId !== predictionRun.projectId || sliceInstance.imageId !== image.id) {
      throw new PredictionProvenanceError("PROJECT_MISMATCH");
    }
  }

  if (input.artifactVersionId) {
    const version = await db.annotationArtifactVersion.findUnique({
      where: { id: input.artifactVersionId },
      select: {
        provenance: true,
        artifact: { select: { kind: true, projectId: true, imageId: true } },
      },
    });
    if (!version) throw new PredictionProvenanceError("ARTIFACT_VERSION_NOT_FOUND");
    if (
      version.artifact.kind !== AnnotationArtifactKind.PREDICTION_MASK ||
      version.provenance !== ArtifactProvenance.MODEL_PREDICTION
    ) {
      throw new PredictionProvenanceError("ARTIFACT_NOT_PREDICTION");
    }
    if (version.artifact.projectId !== predictionRun.projectId || version.artifact.imageId !== image.id) {
      throw new PredictionProvenanceError("PROJECT_MISMATCH");
    }
  }

  return db.predictionArtifactProvenance.create({
    data: {
      predictionRun: { connect: { id: predictionRun.id } },
      image: { connect: { id: image.id } },
      targetType: input.targetType,
      predictedClass: input.predictedClass,
      confidenceScore: input.confidenceScore,
      uncertaintyScore: input.uncertaintyScore,
      perClassScores: input.perClassScores,
      outputStats: input.outputStats,
      modelOutputChecksum: input.modelOutputChecksum,
      ...(input.sliceInstanceId ? { sliceInstance: { connect: { id: input.sliceInstanceId } } } : {}),
      ...(input.artifactVersionId ? { artifactVersion: { connect: { id: input.artifactVersionId } } } : {}),
    },
    select: PREDICTION_PROVENANCE_SELECT,
  });
}

export async function resolveTaskPredictionProvenance(params: {
  taskId: string;
}, db: ProvenanceDb = prisma) {
  const task = await db.annotationTask.findUnique({
    where: { id: params.taskId },
    select: {
      id: true,
      type: true,
      predictionRun: { select: PREDICTION_RUN_SELECT },
      predictionProvenance: { select: PREDICTION_PROVENANCE_SELECT },
      sourceArtifactVersionId: true,
      confidenceScore: true,
      uncertaintyScore: true,
      modelSource: true,
      taskReason: true,
    },
  });
  if (!task) throw new PredictionProvenanceError("TASK_NOT_FOUND");
  return task;
}

export function isPredictionProvenanceExportReady() {
  return false;
}

export function predictionProvenanceErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof PredictionProvenanceError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code.endsWith("_NOT_FOUND")
          ? 404
          : error.code === "DUPLICATE_INFERENCE_RUN"
            ? 409
            : 400;
    return { error: error.code, status };
  }

  return { error: "PREDICTION_PROVENANCE_FAILED", status: 500 };
}
