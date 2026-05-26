-- CreateEnum
CREATE TYPE "ModelTaskType" AS ENUM ('SEMANTIC_SEGMENTATION', 'SUPPORT_SEGMENTATION', 'INSTANCE_SEGMENTATION', 'SLICE_CLASSIFICATION', 'COMBINED', 'OTHER');

-- CreateEnum
CREATE TYPE "PredictionRunStatus" AS ENUM ('CREATED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PredictionTargetType" AS ENUM ('SEMANTIC_MASK', 'SLICE_SUPPORT_MASK', 'INSTANCE_MASK', 'SLICE_CLASSIFICATION');

-- AlterTable
ALTER TABLE "AnnotationTask" ADD COLUMN     "predictionProvenanceId" TEXT,
ADD COLUMN     "predictionRunId" TEXT;

-- CreateTable
CREATE TABLE "ModelRun" (
    "id" TEXT NOT NULL,
    "modelFamily" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT,
    "taskType" "ModelTaskType" NOT NULL,
    "checkpointId" TEXT,
    "checkpointPath" TEXT,
    "checkpointHash" TEXT,
    "trainingRunId" TEXT,
    "trainingDatasetRef" TEXT,
    "trainingExportBatchId" TEXT,
    "trainingCodeVersion" TEXT,
    "trainingGitCommit" TEXT,
    "configHash" TEXT,
    "createdById" TEXT,
    "notes" TEXT,
    "warnings" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionRun" (
    "id" TEXT NOT NULL,
    "modelRunId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceExportBatchId" TEXT,
    "sourceDatasetRef" TEXT,
    "selectionCriteria" JSONB,
    "inferenceRunId" TEXT,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PredictionRunStatus" NOT NULL DEFAULT 'CREATED',
    "inputImageCount" INTEGER,
    "outputPredictionCount" INTEGER,
    "aggregateConfidenceSummary" JSONB,
    "aggregateUncertaintySummary" JSONB,
    "configHash" TEXT,
    "notes" TEXT,
    "warnings" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionArtifactProvenance" (
    "id" TEXT NOT NULL,
    "predictionRunId" TEXT NOT NULL,
    "artifactVersionId" TEXT,
    "imageId" TEXT NOT NULL,
    "sliceInstanceId" TEXT,
    "targetType" "PredictionTargetType" NOT NULL,
    "predictedClass" "SliceClass",
    "confidenceScore" DOUBLE PRECISION,
    "uncertaintyScore" DOUBLE PRECISION,
    "perClassScores" JSONB,
    "outputStats" JSONB,
    "modelOutputChecksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionArtifactProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelRun_taskType_idx" ON "ModelRun"("taskType");

-- CreateIndex
CREATE INDEX "ModelRun_createdById_idx" ON "ModelRun"("createdById");

-- CreateIndex
CREATE INDEX "ModelRun_trainingExportBatchId_idx" ON "ModelRun"("trainingExportBatchId");

-- CreateIndex
CREATE INDEX "ModelRun_modelName_modelVersion_idx" ON "ModelRun"("modelName", "modelVersion");

-- CreateIndex
CREATE INDEX "PredictionRun_projectId_generatedAt_idx" ON "PredictionRun"("projectId", "generatedAt");

-- CreateIndex
CREATE INDEX "PredictionRun_modelRunId_idx" ON "PredictionRun"("modelRunId");

-- CreateIndex
CREATE INDEX "PredictionRun_generatedById_idx" ON "PredictionRun"("generatedById");

-- CreateIndex
CREATE INDEX "PredictionRun_sourceExportBatchId_idx" ON "PredictionRun"("sourceExportBatchId");

-- CreateIndex
CREATE INDEX "PredictionRun_status_idx" ON "PredictionRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionRun_projectId_modelRunId_inferenceRunId_key" ON "PredictionRun"("projectId", "modelRunId", "inferenceRunId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionArtifactProvenance_artifactVersionId_key" ON "PredictionArtifactProvenance"("artifactVersionId");

-- CreateIndex
CREATE INDEX "PredictionArtifactProvenance_predictionRunId_idx" ON "PredictionArtifactProvenance"("predictionRunId");

-- CreateIndex
CREATE INDEX "PredictionArtifactProvenance_imageId_idx" ON "PredictionArtifactProvenance"("imageId");

-- CreateIndex
CREATE INDEX "PredictionArtifactProvenance_sliceInstanceId_idx" ON "PredictionArtifactProvenance"("sliceInstanceId");

-- CreateIndex
CREATE INDEX "PredictionArtifactProvenance_targetType_idx" ON "PredictionArtifactProvenance"("targetType");

-- CreateIndex
CREATE INDEX "AnnotationTask_predictionRunId_idx" ON "AnnotationTask"("predictionRunId");

-- CreateIndex
CREATE INDEX "AnnotationTask_predictionProvenanceId_idx" ON "AnnotationTask"("predictionProvenanceId");

-- AddForeignKey
ALTER TABLE "AnnotationTask" ADD CONSTRAINT "AnnotationTask_predictionRunId_fkey" FOREIGN KEY ("predictionRunId") REFERENCES "PredictionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationTask" ADD CONSTRAINT "AnnotationTask_predictionProvenanceId_fkey" FOREIGN KEY ("predictionProvenanceId") REFERENCES "PredictionArtifactProvenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRun" ADD CONSTRAINT "ModelRun_trainingExportBatchId_fkey" FOREIGN KEY ("trainingExportBatchId") REFERENCES "ExportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRun" ADD CONSTRAINT "ModelRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionRun" ADD CONSTRAINT "PredictionRun_modelRunId_fkey" FOREIGN KEY ("modelRunId") REFERENCES "ModelRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionRun" ADD CONSTRAINT "PredictionRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionRun" ADD CONSTRAINT "PredictionRun_sourceExportBatchId_fkey" FOREIGN KEY ("sourceExportBatchId") REFERENCES "ExportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionRun" ADD CONSTRAINT "PredictionRun_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionArtifactProvenance" ADD CONSTRAINT "PredictionArtifactProvenance_predictionRunId_fkey" FOREIGN KEY ("predictionRunId") REFERENCES "PredictionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionArtifactProvenance" ADD CONSTRAINT "PredictionArtifactProvenance_artifactVersionId_fkey" FOREIGN KEY ("artifactVersionId") REFERENCES "AnnotationArtifactVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionArtifactProvenance" ADD CONSTRAINT "PredictionArtifactProvenance_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionArtifactProvenance" ADD CONSTRAINT "PredictionArtifactProvenance_sliceInstanceId_fkey" FOREIGN KEY ("sliceInstanceId") REFERENCES "SliceInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
