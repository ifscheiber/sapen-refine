import crypto from "crypto";
import path from "path";
import JSZip from "jszip";
import {
  AnnotationArtifactKind,
  AnnotationTaskType,
  ArtifactProvenance,
  ExportTarget,
  PredictionTargetType,
  Prisma,
  PrismaClient,
  type AnnotationProjectRole,
} from "@prisma/client";

import { canExportPredictionAnalysis } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import {
  PREDICTION_QA_COMPARISON,
  PREDICTION_QA_METRICS_VERSION,
  computeBinaryMaskMetrics,
  computeSemanticMaskMetrics,
  notComputedQaMetrics,
  supportValueFromLabels,
  type MetricLabelDefinition,
  type PredictionQaNotComputedReason,
} from "@/server/domain/predictionAnalysisMetrics";
import { getObjectBytes, putObject } from "@/server/storage/s3";
import { normalizeChecksum } from "@/server/uploads/integrity";

type PredictionAnalysisDb = PrismaClient | Prisma.TransactionClient;

const MANIFEST_VERSION = "sapen-annotate-prediction-analysis-export-v1";
const DEFAULT_TARGET_TYPES: PredictionTargetType[] = [
  PredictionTargetType.SEMANTIC_MASK,
  PredictionTargetType.SLICE_SUPPORT_MASK,
  PredictionTargetType.SLICE_CLASSIFICATION,
];

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
} satisfies Prisma.UserSelect;

const ARTIFACT_VERSION_SELECT = {
  id: true,
  version: true,
  reviewState: true,
  provenance: true,
  storageKey: true,
  contentType: true,
  size: true,
  checksum: true,
  width: true,
  height: true,
  format: true,
  coordinateSpace: true,
  labelSchemaVersionId: true,
  taskId: true,
  parentVersionId: true,
  createdAt: true,
  createdBy: { select: USER_SELECT },
  artifact: {
    select: {
      id: true,
      kind: true,
      projectId: true,
      imageId: true,
    },
  },
} satisfies Prisma.AnnotationArtifactVersionSelect;

const CLASSIFICATION_SELECT = {
  id: true,
  version: true,
  class: true,
  labelSchemaVersionId: true,
  sliceInstanceId: true,
  reviewState: true,
  taskId: true,
  createdAt: true,
  createdBy: { select: USER_SELECT },
} satisfies Prisma.SliceClassificationVersionSelect;

const PREDICTION_SELECT = {
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
  predictionRun: {
    select: {
      id: true,
      projectId: true,
      modelRunId: true,
      sourceExportBatchId: true,
      sourceDatasetRef: true,
      selectionCriteria: true,
      inferenceRunId: true,
      generatedBy: { select: USER_SELECT },
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
      modelRun: {
        select: {
          id: true,
          modelFamily: true,
          modelName: true,
          modelVersion: true,
          taskType: true,
          checkpointId: true,
          checkpointHash: true,
          trainingRunId: true,
          trainingDatasetRef: true,
          trainingExportBatchId: true,
          trainingCodeVersion: true,
          trainingGitCommit: true,
          configHash: true,
          notes: true,
          warnings: true,
          metadata: true,
          createdAt: true,
        },
      },
    },
  },
  artifactVersion: { select: ARTIFACT_VERSION_SELECT },
  image: {
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
  tasks: {
    where: { type: AnnotationTaskType.MODEL_PREDICTION_CORRECTION },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      priority: true,
      taskReason: true,
      confidenceScore: true,
      uncertaintyScore: true,
      modelSource: true,
      assignee: { select: USER_SELECT },
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.PredictionArtifactProvenanceSelect;

type SelectedArtifactVersion = Prisma.AnnotationArtifactVersionGetPayload<{
  select: typeof ARTIFACT_VERSION_SELECT;
}>;
type SelectedClassification = Prisma.SliceClassificationVersionGetPayload<{
  select: typeof CLASSIFICATION_SELECT;
}>;
type SelectedPrediction = Prisma.PredictionArtifactProvenanceGetPayload<{
  select: typeof PREDICTION_SELECT;
}>;

type PredictionAnalysisSelection = {
  predictionRunId: string | null;
  modelRunId: string | null;
  targetTypes: PredictionTargetType[];
  includeHumanReferences: boolean;
};

type PredictionAnalysisCandidate = {
  prediction: SelectedPrediction;
  humanCorrection: SelectedArtifactVersion | null;
  approvedGroundTruthArtifact: SelectedArtifactVersion | null;
  approvedGroundTruthClassification: SelectedClassification | null;
  state:
    | "prediction_only"
    | "prediction_with_correction_draft"
    | "prediction_with_submitted_correction"
    | "prediction_with_approved_human_reference"
    | "prediction_without_matching_human_reference";
  warnings: string[];
};

export class PredictionAnalysisExportError extends Error {
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

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  throw new PredictionAnalysisExportError("INVALID_INCLUDE_HUMAN_REFERENCES");
}

function parseTargetTypes(value: unknown) {
  if (value === undefined || value === null || value === "") return DEFAULT_TARGET_TYPES;
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  if (rawValues.length === 0) throw new PredictionAnalysisExportError("PREDICTION_TARGETS_REQUIRED");

  const parsed: PredictionTargetType[] = [];
  for (const raw of rawValues) {
    const target = cleanText(raw);
    if (!target || !Object.values(PredictionTargetType).includes(target as PredictionTargetType)) {
      throw new PredictionAnalysisExportError("PREDICTION_TARGET_INVALID");
    }
    if (!parsed.includes(target as PredictionTargetType)) parsed.push(target as PredictionTargetType);
  }
  if (parsed.length === 0) throw new PredictionAnalysisExportError("PREDICTION_TARGETS_REQUIRED");
  return parsed;
}

export function parsePredictionAnalysisSelection(input: unknown): PredictionAnalysisSelection {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return {
    predictionRunId: cleanText(body.predictionRunId),
    modelRunId: cleanText(body.modelRunId),
    targetTypes: parseTargetTypes(body.targetTypes),
    includeHumanReferences: parseBoolean(body.includeHumanReferences, true),
  };
}

function canExport(role: AnnotationProjectRole) {
  return canExportPredictionAnalysis(role);
}

function sha256(bytes: Uint8Array | string) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function safeExtension(filename: string | null, contentType: string | null, fallback: string) {
  const ext = filename ? path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  if (ext) return ext;
  if (contentType === "image/png") return ".png";
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/svg+xml") return ".svg";
  return fallback;
}

function targetSlug(targetType: PredictionTargetType) {
  if (targetType === PredictionTargetType.SEMANTIC_MASK) return "semantic";
  if (targetType === PredictionTargetType.SLICE_SUPPORT_MASK) return "support";
  if (targetType === PredictionTargetType.INSTANCE_MASK) return "instance";
  return "classification";
}

function artifactKindForPredictionTarget(targetType: PredictionTargetType) {
  if (targetType === PredictionTargetType.SEMANTIC_MASK) return AnnotationArtifactKind.SEMANTIC_MASK;
  if (targetType === PredictionTargetType.SLICE_SUPPORT_MASK) return AnnotationArtifactKind.SLICE_SUPPORT_MASK;
  if (targetType === PredictionTargetType.INSTANCE_MASK) return AnnotationArtifactKind.INSTANCE_MASK;
  return null;
}

function userManifest(user: { id: string; email: string; name: string | null } | null) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

function artifactManifest(version: SelectedArtifactVersion, filePath: string) {
  return {
    artifactVersionId: version.id,
    version: version.version,
    reviewState: version.reviewState,
    provenance: version.provenance,
    path: filePath,
    checksum: version.checksum,
    size: version.size,
    width: version.width,
    height: version.height,
    format: version.format,
    coordinateSpace: version.coordinateSpace,
    labelSchemaVersionId: version.labelSchemaVersionId,
    taskId: version.taskId,
    parentVersionId: version.parentVersionId,
    createdBy: userManifest(version.createdBy),
    createdAt: version.createdAt.toISOString(),
  };
}

async function getProjectMembership(db: PredictionAnalysisDb, projectId: string, userId: string) {
  const project = await db.annotationProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      members: { where: { userId }, select: { role: true } },
    },
  });
  if (!project) throw new PredictionAnalysisExportError("PROJECT_NOT_FOUND", 404);
  const membership = project.members[0];
  if (!membership) throw new PredictionAnalysisExportError("FORBIDDEN", 403);
  return { project, membership };
}

async function loadLatestHumanCorrection(params: {
  db: PredictionAnalysisDb;
  prediction: SelectedPrediction;
}) {
  if (!params.prediction.artifactVersionId) return null;
  return params.db.annotationArtifactVersion.findFirst({
    where: {
      parentVersionId: params.prediction.artifactVersionId,
      provenance: ArtifactProvenance.HUMAN_CORRECTION,
    },
    orderBy: [{ createdAt: "desc" }, { version: "desc" }, { id: "asc" }],
    select: ARTIFACT_VERSION_SELECT,
  });
}

async function loadLatestApprovedArtifact(params: {
  db: PredictionAnalysisDb;
  imageId: string;
  kind: AnnotationArtifactKind;
}) {
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
  if (!artifact) return null;

  return params.db.annotationArtifactVersion.findFirst({
    where: { artifactId: artifact.id, reviewState: "APPROVED" },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    select: ARTIFACT_VERSION_SELECT,
  });
}

async function loadLatestApprovedClassification(db: PredictionAnalysisDb, imageId: string) {
  return db.sliceClassificationVersion.findFirst({
    where: { imageId, reviewState: "APPROVED" },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    select: CLASSIFICATION_SELECT,
  });
}

function candidateState(params: {
  humanCorrection: SelectedArtifactVersion | null;
  approvedGroundTruthArtifact: SelectedArtifactVersion | null;
  approvedGroundTruthClassification: SelectedClassification | null;
  includeHumanReferences: boolean;
}) {
  if (params.approvedGroundTruthArtifact || params.approvedGroundTruthClassification) {
    return "prediction_with_approved_human_reference" as const;
  }
  if (params.humanCorrection?.reviewState === "SUBMITTED") {
    return "prediction_with_submitted_correction" as const;
  }
  if (params.humanCorrection) return "prediction_with_correction_draft" as const;
  if (params.includeHumanReferences) return "prediction_without_matching_human_reference" as const;
  return "prediction_only" as const;
}

function candidateWarnings(candidate: Omit<PredictionAnalysisCandidate, "warnings" | "state">) {
  const warnings = ["PREDICTION_PROPOSAL_NOT_GROUND_TRUTH"];
  const { prediction } = candidate;
  if (!normalizeChecksum(prediction.image.checksum)) warnings.push("MISSING_IMAGE_CHECKSUM");
  if (!prediction.image.width || !prediction.image.height) warnings.push("MISSING_IMAGE_DIMENSIONS");
  if (prediction.targetType !== PredictionTargetType.SLICE_CLASSIFICATION && !prediction.artifactVersion) {
    warnings.push("PREDICTION_ARTIFACT_FILE_MISSING");
  }
  if (prediction.artifactVersion) {
    if (
      prediction.artifactVersion.artifact.kind !== AnnotationArtifactKind.PREDICTION_MASK ||
      prediction.artifactVersion.provenance !== ArtifactProvenance.MODEL_PREDICTION
    ) {
      warnings.push("PREDICTION_ARTIFACT_KIND_INVALID");
    }
    if (!normalizeChecksum(prediction.artifactVersion.checksum)) {
      warnings.push("MISSING_PREDICTION_ARTIFACT_CHECKSUM");
    }
  }
  if (!candidate.humanCorrection && !candidate.approvedGroundTruthArtifact && !candidate.approvedGroundTruthClassification) {
    warnings.push("MISSING_HUMAN_REFERENCE");
  }
  return Array.from(new Set(warnings));
}

function metricArtifactInputs(params: {
  prediction: SelectedArtifactVersion;
  reference: SelectedArtifactVersion;
}) {
  return {
    predictionArtifactVersionId: params.prediction.id,
    predictionChecksum: params.prediction.checksum,
    predictionWidth: params.prediction.width,
    predictionHeight: params.prediction.height,
    predictionLabelSchemaVersionId: params.prediction.labelSchemaVersionId,
    referenceArtifactVersionId: params.reference.id,
    referenceChecksum: params.reference.checksum,
    referenceWidth: params.reference.width,
    referenceHeight: params.reference.height,
    referenceLabelSchemaVersionId: params.reference.labelSchemaVersionId,
  };
}

function artifactDimensionsMatch(prediction: SelectedArtifactVersion, reference: SelectedArtifactVersion) {
  return (
    prediction.width !== null &&
    prediction.height !== null &&
    reference.width !== null &&
    reference.height !== null &&
    prediction.width === reference.width &&
    prediction.height === reference.height
  );
}

function expectedMaskByteLength(version: SelectedArtifactVersion) {
  if (version.width === null || version.height === null) return null;
  if (version.width <= 0 || version.height <= 0) return null;
  return version.width * version.height;
}

function checksumMatches(version: SelectedArtifactVersion, bytes: Uint8Array) {
  const expected = normalizeChecksum(version.checksum);
  return !expected || expected === sha256(bytes);
}

async function loadMetricLabels(
  db: PredictionAnalysisDb,
  labelSchemaVersionId: string,
): Promise<MetricLabelDefinition[]> {
  const definitions = await db.labelDefinition.findMany({
    where: { schemaVersionId: labelSchemaVersionId },
    orderBy: [{ sortOrder: "asc" }, { stableId: "asc" }],
    select: {
      stableId: true,
      byteValue: true,
      displayName: true,
      semanticMeaning: true,
      applicability: true,
      sortOrder: true,
      isTrainable: true,
    },
  });
  return definitions.map((definition) => ({
    ...definition,
    applicability: definition.applicability,
  }));
}

function qaNotComputed(params: {
  candidate: PredictionAnalysisCandidate;
  reason: PredictionQaNotComputedReason;
  warnings?: string[];
}) {
  return notComputedQaMetrics({
    targetType: params.candidate.prediction.targetType,
    reason: params.reason,
    warnings: params.warnings,
  });
}

async function buildCandidateQaMetrics(params: {
  db: PredictionAnalysisDb;
  candidate: PredictionAnalysisCandidate;
}) {
  const { candidate } = params;
  if (candidate.prediction.targetType === PredictionTargetType.SLICE_CLASSIFICATION) {
    return qaNotComputed({
      candidate,
      reason: "CLASSIFICATION_PREDICTION_NOT_IMPLEMENTED",
    });
  }
  if (
    candidate.prediction.targetType !== PredictionTargetType.SEMANTIC_MASK &&
    candidate.prediction.targetType !== PredictionTargetType.SLICE_SUPPORT_MASK
  ) {
    return qaNotComputed({ candidate, reason: "TARGET_TYPE_UNSUPPORTED" });
  }

  const predictionArtifact = candidate.prediction.artifactVersion;
  if (!predictionArtifact) return qaNotComputed({ candidate, reason: "NO_PREDICTION_ARTIFACT" });
  const referenceArtifact = candidate.approvedGroundTruthArtifact;
  if (!referenceArtifact) return qaNotComputed({ candidate, reason: "NO_APPROVED_REFERENCE" });
  if (!artifactDimensionsMatch(predictionArtifact, referenceArtifact)) {
    return qaNotComputed({ candidate, reason: "DIMENSIONS_MISMATCH" });
  }
  if (
    !predictionArtifact.labelSchemaVersionId ||
    predictionArtifact.labelSchemaVersionId !== referenceArtifact.labelSchemaVersionId
  ) {
    return qaNotComputed({ candidate, reason: "LABEL_SCHEMA_MISMATCH" });
  }

  const expectedLength = expectedMaskByteLength(predictionArtifact);
  if (!expectedLength) return qaNotComputed({ candidate, reason: "DIMENSIONS_MISMATCH" });

  let predictionBytes: Uint8Array;
  let referenceBytes: Uint8Array;
  try {
    [predictionBytes, referenceBytes] = await Promise.all([
      getObjectBytes(predictionArtifact.storageKey),
      getObjectBytes(referenceArtifact.storageKey),
    ]);
  } catch {
    return qaNotComputed({ candidate, reason: "ARTIFACT_READ_FAILED" });
  }
  if (predictionBytes.byteLength !== expectedLength || referenceBytes.byteLength !== expectedLength) {
    return qaNotComputed({ candidate, reason: "DIMENSIONS_MISMATCH" });
  }
  if (!checksumMatches(predictionArtifact, predictionBytes) || !checksumMatches(referenceArtifact, referenceBytes)) {
    return qaNotComputed({
      candidate,
      reason: "ARTIFACT_READ_FAILED",
      warnings: ["CHECKSUM_MISMATCH"],
    });
  }

  const labels = await loadMetricLabels(params.db, predictionArtifact.labelSchemaVersionId);
  const inputs = metricArtifactInputs({ prediction: predictionArtifact, reference: referenceArtifact });

  if (candidate.prediction.targetType === PredictionTargetType.SEMANTIC_MASK) {
    const semantic = computeSemanticMaskMetrics({
      prediction: predictionBytes,
      reference: referenceBytes,
      labels,
    });
    if (semantic.trainablePredictionPixels === 0 && semantic.trainableReferencePixels === 0) {
      return qaNotComputed({ candidate, reason: "EMPTY_REFERENCE_AND_PREDICTION" });
    }
    return {
      computed: true as const,
      metricVersion: PREDICTION_QA_METRICS_VERSION,
      comparison: PREDICTION_QA_COMPARISON,
      targetType: candidate.prediction.targetType,
      inputs,
      semantic,
      warnings: [],
    };
  }

  const supportValue = supportValueFromLabels(labels);
  if (supportValue === null) return qaNotComputed({ candidate, reason: "LABEL_SCHEMA_MISMATCH" });
  const support = computeBinaryMaskMetrics({
    prediction: predictionBytes,
    reference: referenceBytes,
    supportValue,
  });
  if (support.predictionSupportPixels === 0 && support.referenceSupportPixels === 0) {
    return qaNotComputed({ candidate, reason: "EMPTY_REFERENCE_AND_PREDICTION" });
  }
  return {
    computed: true as const,
    metricVersion: PREDICTION_QA_METRICS_VERSION,
    comparison: PREDICTION_QA_COMPARISON,
    targetType: candidate.prediction.targetType,
    inputs,
    support,
    warnings: [],
  };
}

function summarizeQaMetrics(items: Array<{ qaMetrics: Awaited<ReturnType<typeof buildCandidateQaMetrics>> }>) {
  const notComputedReasons: Partial<Record<PredictionQaNotComputedReason, number>> = {};
  let computedItemCount = 0;
  for (const item of items) {
    if (item.qaMetrics.computed) {
      computedItemCount += 1;
      continue;
    }
    notComputedReasons[item.qaMetrics.reason] = (notComputedReasons[item.qaMetrics.reason] ?? 0) + 1;
  }
  return {
    metricVersion: PREDICTION_QA_METRICS_VERSION,
    comparison: PREDICTION_QA_COMPARISON,
    computedItemCount,
    notComputedItemCount: items.length - computedItemCount,
    notComputedReasons,
  };
}

async function buildCandidate(params: {
  db: PredictionAnalysisDb;
  prediction: SelectedPrediction;
  includeHumanReferences: boolean;
}): Promise<PredictionAnalysisCandidate> {
  const kind = artifactKindForPredictionTarget(params.prediction.targetType);
  const humanCorrection = params.includeHumanReferences
    ? await loadLatestHumanCorrection({ db: params.db, prediction: params.prediction })
    : null;
  const approvedGroundTruthArtifact = params.includeHumanReferences && kind
    ? await loadLatestApprovedArtifact({
        db: params.db,
        imageId: params.prediction.imageId,
        kind,
      })
    : null;
  const approvedGroundTruthClassification =
    params.includeHumanReferences && params.prediction.targetType === PredictionTargetType.SLICE_CLASSIFICATION
      ? await loadLatestApprovedClassification(params.db, params.prediction.imageId)
      : null;

  const base = {
    prediction: params.prediction,
    humanCorrection,
    approvedGroundTruthArtifact,
    approvedGroundTruthClassification,
  };
  return {
    ...base,
    state: candidateState({
      humanCorrection,
      approvedGroundTruthArtifact,
      approvedGroundTruthClassification,
      includeHumanReferences: params.includeHumanReferences,
    }),
    warnings: candidateWarnings(base),
  };
}

function predictionWhere(projectId: string, selection: PredictionAnalysisSelection): Prisma.PredictionArtifactProvenanceWhereInput {
  return {
    targetType: { in: selection.targetTypes },
    image: { projectId },
    predictionRun: {
      projectId,
      ...(selection.modelRunId ? { modelRunId: selection.modelRunId } : {}),
    },
    ...(selection.predictionRunId ? { predictionRunId: selection.predictionRunId } : {}),
  };
}

export async function resolveProjectPredictionAnalysisReadiness(params: {
  projectId: string;
  userId: string;
  input?: unknown;
}, db: PredictionAnalysisDb = prisma) {
  const selection = parsePredictionAnalysisSelection(params.input);
  const { project, membership } = await getProjectMembership(db, params.projectId, params.userId);
  const [predictions, predictionRuns] = await Promise.all([
    db.predictionArtifactProvenance.findMany({
      where: predictionWhere(project.id, selection),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: PREDICTION_SELECT,
    }),
    db.predictionRun.findMany({
      where: { projectId: project.id },
      orderBy: [{ generatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        inferenceRunId: true,
        status: true,
        generatedAt: true,
        modelRunId: true,
        modelRun: {
          select: {
            id: true,
            modelFamily: true,
            modelName: true,
            modelVersion: true,
            taskType: true,
          },
        },
        _count: { select: { predictions: true, tasks: true } },
      },
    }),
  ]);
  const candidates = await Promise.all(
    predictions.map((prediction) =>
      buildCandidate({
        db,
        prediction,
        includeHumanReferences: selection.includeHumanReferences,
      }),
    ),
  );

  return {
    project,
    myRole: membership.role,
    canExport: canExport(membership.role),
    selection,
    predictionRuns,
    summary: {
      totalCandidates: candidates.length,
      semanticPredictions: candidates.filter((candidate) => candidate.prediction.targetType === "SEMANTIC_MASK").length,
      supportPredictions: candidates.filter((candidate) => candidate.prediction.targetType === "SLICE_SUPPORT_MASK").length,
      classificationPredictions: candidates.filter((candidate) => candidate.prediction.targetType === "SLICE_CLASSIFICATION").length,
      candidatesWithCorrectionTasks: candidates.filter((candidate) => candidate.prediction.tasks.length > 0).length,
      candidatesWithHumanReferences: candidates.filter((candidate) =>
        Boolean(candidate.humanCorrection || candidate.approvedGroundTruthArtifact || candidate.approvedGroundTruthClassification),
      ).length,
      metricEligibleCandidates: candidates.filter((candidate) =>
        Boolean(
          candidate.prediction.artifactVersion &&
          candidate.approvedGroundTruthArtifact &&
          (
            candidate.prediction.targetType === PredictionTargetType.SEMANTIC_MASK ||
            candidate.prediction.targetType === PredictionTargetType.SLICE_SUPPORT_MASK
          ),
        ),
      ).length,
      candidatesWithoutApprovedReference: candidates.filter((candidate) =>
        (
          candidate.prediction.targetType === PredictionTargetType.SEMANTIC_MASK ||
          candidate.prediction.targetType === PredictionTargetType.SLICE_SUPPORT_MASK
        ) && !candidate.approvedGroundTruthArtifact
      ).length,
      classificationMetricsDeferred: candidates.filter((candidate) =>
        candidate.prediction.targetType === PredictionTargetType.SLICE_CLASSIFICATION
      ).length,
      candidatesWithWarnings: candidates.filter((candidate) => candidate.warnings.length > 0).length,
    },
    candidates,
  };
}

function predictionPath(candidate: PredictionAnalysisCandidate) {
  if (!candidate.prediction.artifactVersion) return null;
  return `predictions/${targetSlug(candidate.prediction.targetType)}/${candidate.prediction.imageId}-${candidate.prediction.id}.u8raw`;
}

function humanCorrectionPath(candidate: PredictionAnalysisCandidate) {
  if (!candidate.humanCorrection) return null;
  return `human-corrections/${targetSlug(candidate.prediction.targetType)}/${candidate.prediction.imageId}-${candidate.humanCorrection.id}.u8raw`;
}

function groundTruthPath(candidate: PredictionAnalysisCandidate) {
  if (!candidate.approvedGroundTruthArtifact) return null;
  return `ground-truth/${targetSlug(candidate.prediction.targetType)}/${candidate.prediction.imageId}-${candidate.approvedGroundTruthArtifact.id}.u8raw`;
}

function imagePath(candidate: PredictionAnalysisCandidate) {
  const ext = safeExtension(candidate.prediction.image.filename, candidate.prediction.image.contentType, ".bin");
  return `images/${candidate.prediction.image.id}${ext}`;
}

function predictionRunManifest(run: SelectedPrediction["predictionRun"]) {
  return {
    id: run.id,
    modelRunId: run.modelRunId,
    sourceExportBatchId: run.sourceExportBatchId,
    sourceDatasetRef: run.sourceDatasetRef,
    selectionCriteria: run.selectionCriteria,
    inferenceRunId: run.inferenceRunId,
    generatedBy: userManifest(run.generatedBy),
    generatedAt: run.generatedAt.toISOString(),
    status: run.status,
    inputImageCount: run.inputImageCount,
    outputPredictionCount: run.outputPredictionCount,
    aggregateConfidenceSummary: run.aggregateConfidenceSummary,
    aggregateUncertaintySummary: run.aggregateUncertaintySummary,
    configHash: run.configHash,
    notes: run.notes,
    warnings: run.warnings,
    metadata: run.metadata,
  };
}

function modelRunManifest(run: SelectedPrediction["predictionRun"]["modelRun"]) {
  return {
    id: run.id,
    modelFamily: run.modelFamily,
    modelName: run.modelName,
    modelVersion: run.modelVersion,
    taskType: run.taskType,
    checkpointId: run.checkpointId,
    checkpointHash: run.checkpointHash,
    trainingRunId: run.trainingRunId,
    trainingDatasetRef: run.trainingDatasetRef,
    trainingExportBatchId: run.trainingExportBatchId,
    trainingCodeVersion: run.trainingCodeVersion,
    trainingGitCommit: run.trainingGitCommit,
    configHash: run.configHash,
    notes: run.notes,
    warnings: run.warnings,
    metadata: run.metadata,
    createdAt: run.createdAt.toISOString(),
  };
}

async function buildManifest(params: {
  db: PredictionAnalysisDb;
  exportId: string;
  exportedAt: Date;
  exportedBy: { id: string; email: string; name: string | null };
  project: { id: string; name: string };
  selection: PredictionAnalysisSelection;
  candidates: PredictionAnalysisCandidate[];
}) {
  const predictionRuns = Array.from(
    new Map(params.candidates.map((candidate) => [candidate.prediction.predictionRun.id, candidate.prediction.predictionRun])),
  ).map(([, run]) => predictionRunManifest(run));
  const modelRuns = Array.from(
    new Map(params.candidates.map((candidate) => [candidate.prediction.predictionRun.modelRun.id, candidate.prediction.predictionRun.modelRun])),
  ).map(([, run]) => modelRunManifest(run));

  const items = await Promise.all(params.candidates.map(async (candidate) => {
    const predictionFilePath = predictionPath(candidate);
    const correctionFilePath = humanCorrectionPath(candidate);
    const groundTruthFilePath = groundTruthPath(candidate);
    const task = candidate.prediction.tasks[0] ?? null;
    const qaMetrics = await buildCandidateQaMetrics({ db: params.db, candidate });
    return {
      state: candidate.state,
      image: {
        id: candidate.prediction.image.id,
        filename: candidate.prediction.image.filename,
        path: imagePath(candidate),
        contentType: candidate.prediction.image.contentType,
        size: candidate.prediction.image.size,
        width: candidate.prediction.image.width,
        height: candidate.prediction.image.height,
        checksum: candidate.prediction.image.checksum,
        uploadedAt: candidate.prediction.image.uploadedAt.toISOString(),
      },
      acquisitionMetadata: candidate.prediction.image.acquisitionMetadata
        ? {
            ...candidate.prediction.image.acquisitionMetadata,
            capturedAt: candidate.prediction.image.acquisitionMetadata.capturedAt?.toISOString() ?? null,
          }
        : null,
      sampleMetadata: candidate.prediction.image.sampleMetadata,
      predictionRunId: candidate.prediction.predictionRunId,
      modelRunId: candidate.prediction.predictionRun.modelRun.id,
      prediction: {
        artifactRole: "model_prediction_proposal",
        groundTruth: false,
        predictionProvenanceId: candidate.prediction.id,
        artifactVersionId: candidate.prediction.artifactVersionId,
        targetType: candidate.prediction.targetType,
        predictedClass: candidate.prediction.predictedClass,
        path: predictionFilePath,
        checksum: candidate.prediction.artifactVersion?.checksum ?? candidate.prediction.modelOutputChecksum,
        modelOutputChecksum: candidate.prediction.modelOutputChecksum,
        confidenceScore: candidate.prediction.confidenceScore,
        uncertaintyScore: candidate.prediction.uncertaintyScore,
        perClassScores: candidate.prediction.perClassScores,
        outputStats: candidate.prediction.outputStats,
        createdAt: candidate.prediction.createdAt.toISOString(),
        artifact: candidate.prediction.artifactVersion && predictionFilePath
          ? artifactManifest(candidate.prediction.artifactVersion, predictionFilePath)
          : null,
      },
      correctionTask: task
        ? {
            taskId: task.id,
            status: task.status,
            reason: task.taskReason,
            priority: task.priority,
            confidenceScore: task.confidenceScore,
            uncertaintyScore: task.uncertaintyScore,
            modelSource: task.modelSource,
            assignee: userManifest(task.assignee),
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
          }
        : null,
      humanCorrection:
        candidate.humanCorrection && correctionFilePath
          ? artifactManifest(candidate.humanCorrection, correctionFilePath)
          : null,
      approvedGroundTruthReference: candidate.approvedGroundTruthArtifact && groundTruthFilePath
        ? artifactManifest(candidate.approvedGroundTruthArtifact, groundTruthFilePath)
        : candidate.approvedGroundTruthClassification
          ? {
              classificationVersionId: candidate.approvedGroundTruthClassification.id,
              version: candidate.approvedGroundTruthClassification.version,
              reviewState: candidate.approvedGroundTruthClassification.reviewState,
              class: candidate.approvedGroundTruthClassification.class,
              sliceInstanceId: candidate.approvedGroundTruthClassification.sliceInstanceId,
              labelSchemaVersionId: candidate.approvedGroundTruthClassification.labelSchemaVersionId,
              taskId: candidate.approvedGroundTruthClassification.taskId,
              createdBy: userManifest(candidate.approvedGroundTruthClassification.createdBy),
              createdAt: candidate.approvedGroundTruthClassification.createdAt.toISOString(),
          }
          : null,
      qaMetrics,
      warnings: candidate.warnings,
    };
  }));
  const qaMetricsSummary = summarizeQaMetrics(items);

  return {
    manifestVersion: MANIFEST_VERSION,
    exportId: params.exportId,
    exportedAt: params.exportedAt.toISOString(),
    exportedBy: params.exportedBy,
    project: params.project,
    selection: {
      predictionRunId: params.selection.predictionRunId,
      modelRunId: params.selection.modelRunId,
      targetTypes: params.selection.targetTypes,
      includeHumanReferences: params.selection.includeHumanReferences,
    },
    modelRuns,
    predictionRuns,
    items,
    warnings: [
      "This export contains model predictions for QA/analysis. It is not a ground-truth training-label export.",
    ],
    summary: {
      itemCount: items.length,
      predictionRunCount: predictionRuns.length,
      modelRunCount: modelRuns.length,
      warningCount: items.reduce((count, item) => count + item.warnings.length, 1),
      qaMetrics: qaMetricsSummary,
    },
  };
}

async function buildZipPackage(params: {
  manifest: Awaited<ReturnType<typeof buildManifest>>;
  candidates: PredictionAnalysisCandidate[];
}) {
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(params.manifest, null, 2));
  const addedImages = new Set<string>();

  for (const item of params.manifest.items) {
    const candidate = params.candidates.find((entry) => entry.prediction.id === item.prediction.predictionProvenanceId);
    if (!candidate) continue;
    if (!addedImages.has(item.image.path)) {
      zip.file(item.image.path, await getObjectBytes(candidate.prediction.image.storageKey));
      addedImages.add(item.image.path);
    }
    if (item.prediction.path && candidate.prediction.artifactVersion) {
      zip.file(item.prediction.path, await getObjectBytes(candidate.prediction.artifactVersion.storageKey));
    }
    if (item.humanCorrection && candidate.humanCorrection) {
      zip.file(item.humanCorrection.path, await getObjectBytes(candidate.humanCorrection.storageKey));
    }
    if (
      item.approvedGroundTruthReference &&
      "artifactVersionId" in item.approvedGroundTruthReference &&
      candidate.approvedGroundTruthArtifact
    ) {
      zip.file(item.approvedGroundTruthReference.path, await getObjectBytes(candidate.approvedGroundTruthArtifact.storageKey));
    }
  }

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

function sanitizeExportBatch(batch: {
  id: string;
  projectId: string;
  target: ExportTarget;
  status: string;
  manifestChecksum: string | null;
  selectionCriteria: Prisma.JsonValue | null;
  warnings: Prisma.JsonValue | null;
  metadataSummary: Prisma.JsonValue | null;
  exportedAt: Date;
  createdAt: Date;
  _count?: { items: number };
}) {
  const metadata =
    batch.metadataSummary && typeof batch.metadataSummary === "object" && !Array.isArray(batch.metadataSummary)
      ? batch.metadataSummary as Record<string, unknown>
      : {};
  const warningList = Array.isArray(batch.warnings) ? batch.warnings : [];
  return {
    id: batch.id,
    projectId: batch.projectId,
    target: batch.target,
    status: batch.status,
    manifestChecksum: batch.manifestChecksum,
    packageChecksum: typeof metadata.packageChecksum === "string" ? metadata.packageChecksum : null,
    itemCount: batch._count?.items ?? (typeof metadata.itemCount === "number" ? metadata.itemCount : 0),
    warningCount: warningList.length,
    qaMetricsSummary:
      metadata.qaMetricsSummary && typeof metadata.qaMetricsSummary === "object" && !Array.isArray(metadata.qaMetricsSummary)
        ? metadata.qaMetricsSummary
        : null,
    selection: batch.selectionCriteria,
    exportedAt: batch.exportedAt,
    createdAt: batch.createdAt,
    downloads:
      batch.status === "COMPLETED"
        ? {
            manifest: `/api/prediction-analysis-exports/${batch.id}/download?file=manifest`,
            package: `/api/prediction-analysis-exports/${batch.id}/download?file=package`,
          }
        : null,
  };
}

export function sanitizePredictionAnalysisReadiness(
  readiness: Awaited<ReturnType<typeof resolveProjectPredictionAnalysisReadiness>>,
) {
  return {
    project: readiness.project,
    myRole: readiness.myRole,
    canExport: readiness.canExport,
    selection: readiness.selection,
    predictionRuns: readiness.predictionRuns,
    summary: readiness.summary,
    candidates: readiness.candidates.map((candidate) => ({
      predictionProvenanceId: candidate.prediction.id,
      predictionRunId: candidate.prediction.predictionRunId,
      modelRunId: candidate.prediction.predictionRun.modelRun.id,
      targetType: candidate.prediction.targetType,
      predictedClass: candidate.prediction.predictedClass,
      confidenceScore: candidate.prediction.confidenceScore,
      uncertaintyScore: candidate.prediction.uncertaintyScore,
      artifactVersionId: candidate.prediction.artifactVersionId,
      state: candidate.state,
      image: {
        id: candidate.prediction.image.id,
        filename: candidate.prediction.image.filename,
        checksum: candidate.prediction.image.checksum,
        width: candidate.prediction.image.width,
        height: candidate.prediction.image.height,
      },
      correctionTask: candidate.prediction.tasks[0]
        ? {
            taskId: candidate.prediction.tasks[0].id,
            status: candidate.prediction.tasks[0].status,
            reason: candidate.prediction.tasks[0].taskReason,
          }
        : null,
      humanCorrectionVersionId: candidate.humanCorrection?.id ?? null,
      approvedGroundTruthReferenceId:
        candidate.approvedGroundTruthArtifact?.id ?? candidate.approvedGroundTruthClassification?.id ?? null,
      warnings: candidate.warnings,
    })),
  };
}

export async function createPredictionAnalysisExportForUser(params: {
  projectId: string;
  userId: string;
  input?: unknown;
}, db: PrismaClient = prisma) {
  const readiness = await resolveProjectPredictionAnalysisReadiness(params, db);
  if (!readiness.canExport) throw new PredictionAnalysisExportError("FORBIDDEN", 403);
  if (readiness.candidates.length === 0) {
    throw new PredictionAnalysisExportError("NO_PREDICTION_ANALYSIS_CANDIDATES", 409);
  }

  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: USER_SELECT,
  });
  if (!user) throw new PredictionAnalysisExportError("USER_NOT_FOUND", 404);

  const selectionCriteria = {
    mode: "prediction_analysis",
    predictionRunId: readiness.selection.predictionRunId,
    modelRunId: readiness.selection.modelRunId,
    targetTypes: readiness.selection.targetTypes,
    includeHumanReferences: readiness.selection.includeHumanReferences,
  };

  const batch = await db.exportBatch.create({
    data: {
      projectId: readiness.project.id,
      target: ExportTarget.PREDICTION_ANALYSIS,
      status: "CREATED",
      manifestFormatVersion: MANIFEST_VERSION,
      selectionCriteria,
      exportedById: user.id,
    },
    select: { id: true, exportedAt: true },
  });

  try {
    const manifest = await buildManifest({
      db,
      exportId: batch.id,
      exportedAt: batch.exportedAt,
      exportedBy: user,
      project: { id: readiness.project.id, name: readiness.project.name },
      selection: readiness.selection,
      candidates: readiness.candidates,
    });
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    const packageBytes = await buildZipPackage({
      manifest,
      candidates: readiness.candidates,
    });
    const exportPrefix = `projects/${readiness.project.id}/prediction-analysis-exports/${batch.id}`;
    const manifestStorageKey = `${exportPrefix}/manifest.json`;
    const packageStorageKey = `${exportPrefix}/package.zip`;
    await putObject(manifestStorageKey, manifestBytes, "application/json");
    await putObject(packageStorageKey, packageBytes, "application/zip");

    const exportItems = manifest.items.flatMap((item) => {
      const rows: Prisma.ExportItemCreateManyExportBatchInput[] = [
        {
          role: "image",
          imageId: item.image.id,
          predictionProvenanceId: item.prediction.predictionProvenanceId,
        },
        {
          role: "prediction-proposal",
          imageId: item.image.id,
          artifactVersionId: item.prediction.artifactVersionId,
          predictionProvenanceId: item.prediction.predictionProvenanceId,
        },
      ];
      if (item.humanCorrection) {
        rows.push({
          role: "human-correction-reference",
          imageId: item.image.id,
          artifactVersionId: item.humanCorrection.artifactVersionId,
          predictionProvenanceId: item.prediction.predictionProvenanceId,
        });
      }
      if (item.approvedGroundTruthReference) {
        if ("artifactVersionId" in item.approvedGroundTruthReference) {
          rows.push({
            role: "approved-ground-truth-reference",
            imageId: item.image.id,
            artifactVersionId: item.approvedGroundTruthReference.artifactVersionId,
            predictionProvenanceId: item.prediction.predictionProvenanceId,
          });
        } else {
          rows.push({
            role: "approved-ground-truth-reference",
            imageId: item.image.id,
            sliceClassificationVersionId: item.approvedGroundTruthReference.classificationVersionId,
            predictionProvenanceId: item.prediction.predictionProvenanceId,
          });
        }
      }
      return rows;
    });

    const completed = await db.exportBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMPLETED",
        manifestStorageKey,
        manifestChecksum: sha256(manifestBytes),
        warnings: manifest.warnings,
        metadataSummary: {
          mode: "prediction_analysis",
          itemCount: manifest.summary.itemCount,
          warningCount: manifest.summary.warningCount,
          qaMetricsSummary: manifest.summary.qaMetrics,
          packageStorageKey,
          packageChecksum: sha256(packageBytes),
          packageSize: packageBytes.byteLength,
        },
        items: {
          createMany: { data: exportItems },
        },
      },
      select: {
        id: true,
        projectId: true,
        target: true,
        status: true,
        manifestChecksum: true,
        selectionCriteria: true,
        warnings: true,
        metadataSummary: true,
        exportedAt: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    });

    await recordAuditEvent({
      action: "PREDICTION_ANALYSIS_EXPORT_CREATED",
      entity: "ExportBatch",
      entityId: completed.id,
      actorId: user.id,
      details: {
        projectId: completed.projectId,
        target: completed.target,
        manifestChecksum: completed.manifestChecksum,
        packageChecksum: sanitizeExportBatch(completed).packageChecksum,
      },
    }, db);

    return sanitizeExportBatch(completed);
  } catch (error) {
    await db.exportBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        warnings: [
          {
            code: error instanceof PredictionAnalysisExportError ? error.code : "PREDICTION_ANALYSIS_EXPORT_FAILED",
            message: error instanceof Error ? error.message : "Unknown export failure",
          },
        ],
      },
    }).catch(() => undefined);
    throw error;
  }
}

async function loadPredictionAnalysisExportForUser(params: {
  exportId: string;
  userId: string;
}, db: PredictionAnalysisDb = prisma) {
  const batch = await db.exportBatch.findUnique({
    where: { id: params.exportId },
    select: {
      id: true,
      projectId: true,
      target: true,
      status: true,
      manifestStorageKey: true,
      manifestChecksum: true,
      selectionCriteria: true,
      warnings: true,
      metadataSummary: true,
      exportedAt: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
  if (!batch || batch.target !== ExportTarget.PREDICTION_ANALYSIS) {
    throw new PredictionAnalysisExportError("PREDICTION_ANALYSIS_EXPORT_NOT_FOUND", 404);
  }
  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: batch.projectId, userId: params.userId } },
    select: { role: true },
  });
  if (!membership || !canExport(membership.role)) {
    throw new PredictionAnalysisExportError("FORBIDDEN", 403);
  }
  return batch;
}

export async function getPredictionAnalysisExportForUser(params: {
  exportId: string;
  userId: string;
}, db: PredictionAnalysisDb = prisma) {
  const batch = await loadPredictionAnalysisExportForUser(params, db);
  return sanitizeExportBatch(batch);
}

export async function readPredictionAnalysisExportFileForUser(params: {
  exportId: string;
  userId: string;
  file: "manifest" | "package";
}, db: PredictionAnalysisDb = prisma) {
  const batch = await loadPredictionAnalysisExportForUser(params, db);
  if (batch.status !== "COMPLETED") throw new PredictionAnalysisExportError("EXPORT_NOT_READY", 409);
  const metadata =
    batch.metadataSummary && typeof batch.metadataSummary === "object" && !Array.isArray(batch.metadataSummary)
      ? batch.metadataSummary as Record<string, unknown>
      : {};
  const key =
    params.file === "manifest"
      ? batch.manifestStorageKey
      : typeof metadata.packageStorageKey === "string"
        ? metadata.packageStorageKey
        : null;
  if (!key) throw new PredictionAnalysisExportError("EXPORT_FILE_NOT_FOUND", 404);

  const bytes = await getObjectBytes(key);
  await recordAuditEvent({
    action: "PREDICTION_ANALYSIS_EXPORT_DOWNLOADED",
    entity: "ExportBatch",
    entityId: batch.id,
    actorId: params.userId,
    details: { projectId: batch.projectId, file: params.file, size: bytes.byteLength },
  }, db);

  return {
    bytes,
    filename:
      params.file === "manifest"
        ? `sapen-prediction-analysis-export-${batch.id}-manifest.json`
        : `sapen-prediction-analysis-export-${batch.id}.zip`,
    contentType: params.file === "manifest" ? "application/json" : "application/zip",
  };
}

export function predictionAnalysisExportErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof PredictionAnalysisExportError) {
    return { error: error.code, status: error.status };
  }
  return { error: "PREDICTION_ANALYSIS_EXPORT_FAILED", status: 500 };
}
