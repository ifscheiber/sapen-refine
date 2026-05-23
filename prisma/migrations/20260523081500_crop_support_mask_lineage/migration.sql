-- RB-088: link crop-space support mask artifact versions to their derived crop and slice instance.
ALTER TABLE "AnnotationArtifactVersion"
  ADD COLUMN "derivedCropId" TEXT,
  ADD COLUMN "sliceInstanceId" TEXT;

CREATE INDEX "AnnotationArtifactVersion_derivedCropId_createdAt_idx"
  ON "AnnotationArtifactVersion"("derivedCropId", "createdAt");

CREATE INDEX "AnnotationArtifactVersion_sliceInstanceId_createdAt_idx"
  ON "AnnotationArtifactVersion"("sliceInstanceId", "createdAt");

ALTER TABLE "AnnotationArtifactVersion"
  ADD CONSTRAINT "AnnotationArtifactVersion_derivedCropId_fkey"
  FOREIGN KEY ("derivedCropId") REFERENCES "DerivedSliceCrop"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnnotationArtifactVersion"
  ADD CONSTRAINT "AnnotationArtifactVersion_sliceInstanceId_fkey"
  FOREIGN KEY ("sliceInstanceId") REFERENCES "SliceInstance"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
