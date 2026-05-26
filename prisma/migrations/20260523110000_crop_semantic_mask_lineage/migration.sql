-- RB-089: link crop-space semantic masks to their constraining support version and semantic mode.
CREATE TYPE "CropSemanticMode" AS ENUM ('SAP_HEARTWOOD', 'COPPER');

ALTER TABLE "AnnotationArtifactVersion"
  ADD COLUMN "supportMaskVersionId" TEXT,
  ADD COLUMN "cropSemanticMode" "CropSemanticMode";

CREATE INDEX "AnnotationArtifactVersion_derivedCropId_cropSemanticMode_createdAt_idx"
  ON "AnnotationArtifactVersion"("derivedCropId", "cropSemanticMode", "createdAt");

CREATE INDEX "AnnotationArtifactVersion_supportMaskVersionId_createdAt_idx"
  ON "AnnotationArtifactVersion"("supportMaskVersionId", "createdAt");

ALTER TABLE "AnnotationArtifactVersion"
  ADD CONSTRAINT "AnnotationArtifactVersion_supportMaskVersionId_fkey"
  FOREIGN KEY ("supportMaskVersionId") REFERENCES "AnnotationArtifactVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
