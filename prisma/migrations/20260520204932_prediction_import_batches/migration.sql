-- CreateEnum
CREATE TYPE "PredictionImportBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PredictionImportBatchItemStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'RETRY_PENDING');

-- CreateEnum
CREATE TYPE "PredictionImportBatchSourceKind" AS ENUM ('ZIP_UPLOAD', 'MANIFEST_UPLOAD');

-- CreateTable
CREATE TABLE "PredictionImportBatchJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "predictionRunId" TEXT NOT NULL,
    "createdById" TEXT,
    "status" "PredictionImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "manifestVersion" TEXT NOT NULL,
    "sourceKind" "PredictionImportBatchSourceKind" NOT NULL DEFAULT 'ZIP_UPLOAD',
    "sourceFilename" TEXT,
    "sourceChecksum" TEXT,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "pendingItems" INTEGER NOT NULL DEFAULT 0,
    "processingItems" INTEGER NOT NULL DEFAULT 0,
    "succeededItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "skippedItems" INTEGER NOT NULL DEFAULT 0,
    "retryPendingItems" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "errorSummaryJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionImportBatchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionImportBatchItem" (
    "id" TEXT NOT NULL,
    "batchJobId" TEXT NOT NULL,
    "clientItemId" TEXT,
    "imageId" TEXT NOT NULL,
    "targetType" "PredictionTargetType" NOT NULL,
    "status" "PredictionImportBatchItemStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "sourcePath" TEXT,
    "sourceFilename" TEXT,
    "stagingKey" TEXT NOT NULL,
    "expectedChecksum" TEXT,
    "expectedWidth" INTEGER NOT NULL,
    "expectedHeight" INTEGER NOT NULL,
    "contentType" TEXT,
    "format" TEXT NOT NULL DEFAULT 'u8raw-v1',
    "coordinateSpace" "CoordinateSpace" NOT NULL DEFAULT 'IMAGE_PIXEL',
    "confidenceScore" DOUBLE PRECISION,
    "uncertaintyScore" DOUBLE PRECISION,
    "perClassScoresJson" JSONB,
    "outputStatsJson" JSONB,
    "predictionArtifactVersionId" TEXT,
    "predictionProvenanceId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionImportBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PredictionImportBatchJob_projectId_createdAt_idx" ON "PredictionImportBatchJob"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "PredictionImportBatchJob_predictionRunId_status_idx" ON "PredictionImportBatchJob"("predictionRunId", "status");

-- CreateIndex
CREATE INDEX "PredictionImportBatchJob_status_createdAt_idx" ON "PredictionImportBatchJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionImportBatchItem_predictionArtifactVersionId_key" ON "PredictionImportBatchItem"("predictionArtifactVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionImportBatchItem_predictionProvenanceId_key" ON "PredictionImportBatchItem"("predictionProvenanceId");

-- CreateIndex
CREATE INDEX "PredictionImportBatchItem_batchJobId_status_idx" ON "PredictionImportBatchItem"("batchJobId", "status");

-- CreateIndex
CREATE INDEX "PredictionImportBatchItem_status_nextRetryAt_idx" ON "PredictionImportBatchItem"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "PredictionImportBatchItem_imageId_idx" ON "PredictionImportBatchItem"("imageId");

-- CreateIndex
CREATE INDEX "PredictionImportBatchItem_targetType_idx" ON "PredictionImportBatchItem"("targetType");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionImportBatchItem_batchJobId_clientItemId_key" ON "PredictionImportBatchItem"("batchJobId", "clientItemId");

-- AddForeignKey
ALTER TABLE "PredictionImportBatchJob" ADD CONSTRAINT "PredictionImportBatchJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionImportBatchJob" ADD CONSTRAINT "PredictionImportBatchJob_predictionRunId_fkey" FOREIGN KEY ("predictionRunId") REFERENCES "PredictionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionImportBatchJob" ADD CONSTRAINT "PredictionImportBatchJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionImportBatchItem" ADD CONSTRAINT "PredictionImportBatchItem_batchJobId_fkey" FOREIGN KEY ("batchJobId") REFERENCES "PredictionImportBatchJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionImportBatchItem" ADD CONSTRAINT "PredictionImportBatchItem_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionImportBatchItem" ADD CONSTRAINT "PredictionImportBatchItem_predictionArtifactVersionId_fkey" FOREIGN KEY ("predictionArtifactVersionId") REFERENCES "AnnotationArtifactVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionImportBatchItem" ADD CONSTRAINT "PredictionImportBatchItem_predictionProvenanceId_fkey" FOREIGN KEY ("predictionProvenanceId") REFERENCES "PredictionArtifactProvenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
