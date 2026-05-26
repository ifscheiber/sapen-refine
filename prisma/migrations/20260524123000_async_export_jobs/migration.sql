ALTER TYPE "ExportStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ExportStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

ALTER TABLE "ExportBatch"
  ADD COLUMN "packageStorageKey" TEXT,
  ADD COLUMN "packageChecksum" TEXT,
  ADD COLUMN "packageSize" INTEGER,
  ADD COLUMN "jobAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "jobMaxAttempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN "processorId" TEXT,
  ADD COLUMN "processorRunId" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "errorCode" TEXT,
  ADD COLUMN "errorMessage" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ExportBatch"
SET
  "packageStorageKey" = COALESCE(
    "packageStorageKey",
    CASE
      WHEN jsonb_typeof("metadataSummary"::jsonb) = 'object'
      THEN "metadataSummary"::jsonb ->> 'packageStorageKey'
      ELSE NULL
    END
  ),
  "packageChecksum" = COALESCE(
    "packageChecksum",
    CASE
      WHEN jsonb_typeof("metadataSummary"::jsonb) = 'object'
      THEN "metadataSummary"::jsonb ->> 'packageChecksum'
      ELSE NULL
    END
  ),
  "packageSize" = COALESCE(
    "packageSize",
    CASE
      WHEN jsonb_typeof("metadataSummary"::jsonb) = 'object'
        AND jsonb_typeof("metadataSummary"::jsonb -> 'packageSize') = 'number'
      THEN ("metadataSummary"::jsonb ->> 'packageSize')::integer
      ELSE NULL
    END
  ),
  "completedAt" = CASE WHEN "status" = 'COMPLETED' THEN COALESCE("completedAt", "exportedAt") ELSE "completedAt" END,
  "failedAt" = CASE WHEN "status" = 'FAILED' THEN COALESCE("failedAt", "exportedAt") ELSE "failedAt" END;

CREATE INDEX "ExportBatch_status_nextRetryAt_idx" ON "ExportBatch"("status", "nextRetryAt");
CREATE INDEX "ExportBatch_status_leaseExpiresAt_idx" ON "ExportBatch"("status", "leaseExpiresAt");
CREATE INDEX "ExportBatch_status_createdAt_idx" ON "ExportBatch"("status", "createdAt");
CREATE INDEX "ExportBatch_processorRunId_idx" ON "ExportBatch"("processorRunId");
