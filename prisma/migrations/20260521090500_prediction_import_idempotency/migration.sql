-- RB-065: make batch prediction import retries idempotent even if a worker
-- crashes after creating prediction provenance but before updating the batch item.
ALTER TABLE "public"."PredictionArtifactProvenance"
ADD COLUMN "sourceBatchItemId" TEXT;

CREATE UNIQUE INDEX "PredictionArtifactProvenance_sourceBatchItemId_key"
ON "public"."PredictionArtifactProvenance"("sourceBatchItemId");
