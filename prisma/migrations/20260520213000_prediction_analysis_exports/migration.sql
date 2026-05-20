ALTER TYPE "ExportTarget" ADD VALUE 'PREDICTION_ANALYSIS';

ALTER TABLE "ExportItem" ADD COLUMN "predictionProvenanceId" TEXT;

ALTER TABLE "ExportItem"
ADD CONSTRAINT "ExportItem_predictionProvenanceId_fkey"
FOREIGN KEY ("predictionProvenanceId")
REFERENCES "PredictionArtifactProvenance"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "ExportItem_predictionProvenanceId_idx" ON "ExportItem"("predictionProvenanceId");
