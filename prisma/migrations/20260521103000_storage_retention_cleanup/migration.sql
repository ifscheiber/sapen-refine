-- RB-066: track cleanup of temporary prediction-batch staging objects.
ALTER TABLE "public"."PredictionImportBatchItem"
ADD COLUMN "stagingPurgedAt" TIMESTAMP(3),
ADD COLUMN "stagingPurgeReason" TEXT;

CREATE INDEX "PredictionImportBatchItem_stagingPurgedAt_idx"
ON "public"."PredictionImportBatchItem"("stagingPurgedAt");
