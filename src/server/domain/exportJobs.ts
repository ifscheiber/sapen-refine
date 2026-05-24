import { randomUUID } from "crypto";
import { ExportStatus, ExportTarget, type AnnotationProjectRole } from "@prisma/client";

import { canExportPredictionAnalysis, canExportTraining } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import { ExportObjectIntegrityError } from "@/server/domain/exportObjectIntegrity";
import { ExportTrialCapError } from "@/server/domain/exportTrialCaps";
import {
  exportErrorResponse,
  processClaimedTrainingExportJob,
  TrainingExportError,
} from "@/server/domain/exports";
import {
  predictionAnalysisExportErrorResponse,
  PredictionAnalysisExportError,
  processClaimedPredictionAnalysisExportJob,
} from "@/server/domain/predictionAnalysisExports";
import { getRuntimeConfig } from "@/server/runtime/config";

type ProcessorContext = {
  processorId: string;
  processorRunId: string;
  leaseSeconds: number;
  retryDelaySeconds: number;
};

type ExportJobResult = {
  exportId: string;
  target: ExportTarget;
  status: ExportStatus;
  errorCode: string | null;
};

export class ExportJobError extends Error {
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

function parsePositiveInteger(value: unknown, code: string, fallback: number, max: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new ExportJobError(code, 400);
  return Math.min(parsed, max);
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") throw new ExportJobError("EXPORT_JOB_PROCESS_FLAG_INVALID", 400);
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  throw new ExportJobError("EXPORT_JOB_PROCESS_FLAG_INVALID", 400);
}

function resolveProcessorContext(input: Record<string, unknown>): ProcessorContext {
  const config = getRuntimeConfig().exportJobs;
  return {
    processorId: cleanText(input.processorId) ?? config.processorId,
    processorRunId: cleanText(input.processorRunId) ?? randomUUID(),
    leaseSeconds: config.leaseSeconds,
    retryDelaySeconds: config.retryDelaySeconds,
  };
}

function leaseExpiresAt(now: Date, leaseSeconds: number) {
  return new Date(now.getTime() + leaseSeconds * 1000);
}

function retryAt(now: Date, retryDelaySeconds: number) {
  return new Date(now.getTime() + retryDelaySeconds * 1000);
}

function canProcessTarget(role: AnnotationProjectRole, target: ExportTarget) {
  if (target === ExportTarget.PREDICTION_ANALYSIS) return canExportPredictionAnalysis(role);
  return canExportTraining(role);
}

function failureCode(error: unknown, target: ExportTarget) {
  if (error instanceof ExportObjectIntegrityError || error instanceof ExportTrialCapError) return error.code;
  if (error instanceof TrainingExportError || error instanceof PredictionAnalysisExportError) return error.code;
  return target === ExportTarget.PREDICTION_ANALYSIS
    ? "PREDICTION_ANALYSIS_EXPORT_FAILED"
    : "TRAINING_EXPORT_FAILED";
}

function isNonRetryableExportFailure(code: string) {
  return [
    "EXPORT_OBJECT_INTEGRITY_METADATA_MISSING",
    "EXPORT_OBJECT_INTEGRITY_MISMATCH",
    "EXPORT_INTEGRITY_METADATA_MISSING",
    "EXPORT_ITEM_LIMIT_EXCEEDED",
    "EXPORT_BYTE_LIMIT_EXCEEDED",
    "PREDICTION_ANALYSIS_EXPORT_ITEM_LIMIT_EXCEEDED",
    "PREDICTION_ANALYSIS_EXPORT_BYTE_LIMIT_EXCEEDED",
    "EXPORT_JOB_SNAPSHOT_MISSING",
    "EXPORT_JOB_SNAPSHOT_INVALID",
  ].includes(code);
}

async function accessibleProjectTargets(userId: string) {
  const memberships = await prisma.annotationProjectMember.findMany({
    where: { userId },
    select: { projectId: true, role: true },
  });
  return memberships.flatMap((membership) =>
    Object.values(ExportTarget)
      .filter((target) => canProcessTarget(membership.role, target))
      .map((target) => ({ projectId: membership.projectId, target })),
  );
}

function dueWhere(params: {
  projectTargets: Array<{ projectId: string; target: ExportTarget }>;
  now: Date;
  recoverStale: boolean;
}) {
  return {
    AND: [
      {
        OR: params.projectTargets.map((entry) => ({
          projectId: entry.projectId,
          target: entry.target,
        })),
      },
      {
        OR: [
          {
            status: ExportStatus.PENDING,
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: params.now } }],
          },
          ...(params.recoverStale
            ? [
                {
                  status: ExportStatus.PROCESSING,
                  OR: [{ leaseExpiresAt: { lte: params.now } }, { leaseExpiresAt: null }],
                },
              ]
            : []),
        ],
      },
    ],
  };
}

async function claimJob(params: {
  exportId: string;
  maxAttempts: number;
  now: Date;
  processor: ProcessorContext;
  recoverStale: boolean;
}) {
  const claimed = await prisma.exportBatch.updateMany({
    where: {
      id: params.exportId,
      jobAttemptCount: { lt: params.maxAttempts },
      OR: [
        {
          status: ExportStatus.PENDING,
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: params.now } }],
        },
        ...(params.recoverStale
          ? [
              {
                status: ExportStatus.PROCESSING,
                OR: [{ leaseExpiresAt: { lte: params.now } }, { leaseExpiresAt: null }],
              },
            ]
          : []),
      ],
    },
    data: {
      status: ExportStatus.PROCESSING,
      jobAttemptCount: { increment: 1 },
      processorId: params.processor.processorId,
      processorRunId: params.processor.processorRunId,
      processingStartedAt: params.now,
      leaseExpiresAt: leaseExpiresAt(params.now, params.processor.leaseSeconds),
      nextRetryAt: null,
      failedAt: null,
    },
  });
  return claimed.count === 1;
}

async function failClaimedJob(params: {
  exportId: string;
  target: ExportTarget;
  userId: string;
  error: unknown;
  processor: ProcessorContext;
}) {
  const batch = await prisma.exportBatch.findUnique({
    where: { id: params.exportId },
    select: { id: true, projectId: true, target: true, jobAttemptCount: true, jobMaxAttempts: true },
  });
  if (!batch) {
    return {
      exportId: params.exportId,
      target: params.target,
      status: ExportStatus.FAILED,
      errorCode: "EXPORT_NOT_FOUND",
    };
  }

  const code = failureCode(params.error, params.target);
  const shouldFail = isNonRetryableExportFailure(code) || batch.jobAttemptCount >= batch.jobMaxAttempts;
  const now = new Date();
  const status = shouldFail ? ExportStatus.FAILED : ExportStatus.PENDING;
  await prisma.exportBatch.update({
    where: { id: params.exportId },
    data: {
      status,
      errorCode: code,
      errorMessage: code,
      warnings: [{ code, message: code }],
      failedAt: shouldFail ? now : null,
      nextRetryAt: shouldFail ? null : retryAt(now, params.processor.retryDelaySeconds),
      processorId: null,
      processorRunId: null,
      leaseExpiresAt: null,
    },
  });

  await recordAuditEvent({
    action: shouldFail ? "EXPORT_JOB_FAILED" : "EXPORT_JOB_RETRY_SCHEDULED",
    entity: "ExportBatch",
    entityId: params.exportId,
    actorId: params.userId,
    details: {
      projectId: batch.projectId,
      target: batch.target,
      errorCode: code,
      processorId: params.processor.processorId,
      processorRunId: params.processor.processorRunId,
      attemptCount: batch.jobAttemptCount,
      maxAttempts: batch.jobMaxAttempts,
    },
  });

  return { exportId: params.exportId, target: params.target, status, errorCode: code };
}

async function processClaimedJob(params: {
  exportId: string;
  target: ExportTarget;
  userId: string;
  processor: ProcessorContext;
}) {
  try {
    if (params.target === ExportTarget.PREDICTION_ANALYSIS) {
      await processClaimedPredictionAnalysisExportJob({ exportId: params.exportId, userId: params.userId });
    } else {
      await processClaimedTrainingExportJob({ exportId: params.exportId, userId: params.userId });
    }
    return {
      exportId: params.exportId,
      target: params.target,
      status: ExportStatus.COMPLETED,
      errorCode: null,
    } satisfies ExportJobResult;
  } catch (error) {
    return failClaimedJob({
      exportId: params.exportId,
      target: params.target,
      userId: params.userId,
      error,
      processor: params.processor,
    });
  }
}

export async function processDueExportJobsForUser(params: {
  userId: string;
  input?: unknown;
}) {
  const input = params.input && typeof params.input === "object" ? params.input as Record<string, unknown> : {};
  const config = getRuntimeConfig().exportJobs;
  const maxJobs = parsePositiveInteger(
    input.maxJobs,
    "EXPORT_JOB_PROCESS_MAX_JOBS_INVALID",
    config.maxJobsPerTick,
    config.maxJobsPerTick,
  );
  const recoverStale = parseBoolean(input.recoverStale, true);
  const processor = resolveProcessorContext(input);
  const now = new Date();
  const projectTargets = await accessibleProjectTargets(params.userId);
  if (projectTargets.length === 0) {
    return {
      processorId: processor.processorId,
      processorRunId: processor.processorRunId,
      exportCount: 0,
      completedCount: 0,
      failedCount: 0,
      retryPendingCount: 0,
      results: [],
    };
  }

  const dueJobs = await prisma.exportBatch.findMany({
    where: dueWhere({ projectTargets, now, recoverStale }),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: maxJobs,
    select: { id: true, target: true, jobAttemptCount: true, jobMaxAttempts: true },
  });

  const results: ExportJobResult[] = [];
  for (const job of dueJobs.filter((entry) => entry.jobAttemptCount < entry.jobMaxAttempts)) {
    const claimed = await claimJob({
      exportId: job.id,
      maxAttempts: job.jobMaxAttempts,
      now: new Date(),
      processor,
      recoverStale,
    });
    if (!claimed) continue;
    results.push(await processClaimedJob({
      exportId: job.id,
      target: job.target,
      userId: params.userId,
      processor,
    }));
  }

  const summary = {
    processorId: processor.processorId,
    processorRunId: processor.processorRunId,
    exportCount: results.length,
    completedCount: results.filter((result) => result.status === ExportStatus.COMPLETED).length,
    failedCount: results.filter((result) => result.status === ExportStatus.FAILED).length,
    retryPendingCount: results.filter((result) => result.status === ExportStatus.PENDING).length,
  };

  await recordAuditEvent({
    action: "EXPORT_JOB_DUE_PROCESS_COMPLETED",
    entity: "ExportBatch",
    actorId: params.userId,
    details: {
      ...summary,
      requestedMaxJobs: maxJobs,
      recoverStale,
      exportIds: results.map((result) => result.exportId),
    },
  });

  return { ...summary, results };
}

export function exportJobErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof ExportJobError) return { error: error.code, status: error.status };
  const trainingPayload = exportErrorResponse(error);
  if (trainingPayload.error !== "TRAINING_EXPORT_FAILED") return trainingPayload;
  const predictionPayload = predictionAnalysisExportErrorResponse(error);
  if (predictionPayload.error !== "PREDICTION_ANALYSIS_EXPORT_FAILED") return predictionPayload;
  return { error: "EXPORT_JOB_FAILED", status: 500 };
}
