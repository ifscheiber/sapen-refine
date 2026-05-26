ALTER TYPE "ExportTarget" ADD VALUE 'CROP_TRAINING';

ALTER TABLE "ExportItem"
  ADD COLUMN "derivedCropId" TEXT;

CREATE INDEX "ExportItem_derivedCropId_idx"
  ON "ExportItem"("derivedCropId");

ALTER TABLE "ExportItem"
  ADD CONSTRAINT "ExportItem_derivedCropId_fkey"
  FOREIGN KEY ("derivedCropId") REFERENCES "DerivedSliceCrop"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
