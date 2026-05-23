-- RB-090: record provenance for slice classifications derived from crop semantic masks.
CREATE TYPE "SliceClassificationSource" AS ENUM ('MANUAL', 'AUTO_FROM_SEMANTIC_MASK');

CREATE TYPE "SliceClassificationDerivationReason" AS ENUM (
  'COPPER_PIXELS_PRESENT',
  'SAP_HEARTWOOD_PIXELS_PRESENT',
  'NO_CLASSIFYING_PIXELS',
  'UNKNOWN_PIXELS_PRESENT',
  'SEMANTIC_MODE_LABEL_CONFLICT'
);

ALTER TABLE "SliceClassificationVersion"
  ADD COLUMN "source" "SliceClassificationSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "derivationReason" "SliceClassificationDerivationReason",
  ADD COLUMN "derivedFromSemanticMaskVersionId" TEXT,
  ADD COLUMN "derivedFromSupportMaskVersionId" TEXT,
  ADD COLUMN "derivedFromCropId" TEXT,
  ADD COLUMN "metadataJson" JSONB;

CREATE UNIQUE INDEX "SliceClassificationVersion_derivedFromSemanticMaskVersionId_key"
  ON "SliceClassificationVersion"("derivedFromSemanticMaskVersionId");

CREATE INDEX "SliceClassificationVersion_source_derivationReason_idx"
  ON "SliceClassificationVersion"("source", "derivationReason");

CREATE INDEX "SliceClassificationVersion_derivedFromSupportMaskVersionId_idx"
  ON "SliceClassificationVersion"("derivedFromSupportMaskVersionId");

CREATE INDEX "SliceClassificationVersion_derivedFromCropId_idx"
  ON "SliceClassificationVersion"("derivedFromCropId");

ALTER TABLE "SliceClassificationVersion"
  ADD CONSTRAINT "SliceClassificationVersion_derivedFromSemanticMaskVersionId_fkey"
  FOREIGN KEY ("derivedFromSemanticMaskVersionId") REFERENCES "AnnotationArtifactVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SliceClassificationVersion"
  ADD CONSTRAINT "SliceClassificationVersion_derivedFromSupportMaskVersionId_fkey"
  FOREIGN KEY ("derivedFromSupportMaskVersionId") REFERENCES "AnnotationArtifactVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SliceClassificationVersion"
  ADD CONSTRAINT "SliceClassificationVersion_derivedFromCropId_fkey"
  FOREIGN KEY ("derivedFromCropId") REFERENCES "DerivedSliceCrop"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
