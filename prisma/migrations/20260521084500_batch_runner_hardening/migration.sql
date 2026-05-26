-- RB-065 batch runner hardening.
-- Adds single-host lease/processor metadata for deterministic stale recovery.

ALTER TABLE "PredictionImportBatchItem"
ADD COLUMN "processorId" TEXT,
ADD COLUMN "processorRunId" TEXT,
ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3);

CREATE INDEX "PredictionImportBatchItem_batchJobId_status_leaseExpiresAt_idx"
ON "PredictionImportBatchItem"("batchJobId", "status", "leaseExpiresAt");

CREATE INDEX "PredictionImportBatchItem_status_leaseExpiresAt_idx"
ON "PredictionImportBatchItem"("status", "leaseExpiresAt");

CREATE INDEX "PredictionImportBatchItem_processorRunId_idx"
ON "PredictionImportBatchItem"("processorRunId");
