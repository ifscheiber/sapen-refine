-- RB-094: image-level crop workflow state for BBox set confirmation.

CREATE TYPE "ImageCropBBoxSetStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'NEEDS_UPDATE');

CREATE TABLE "ImageCropWorkflowState" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "bboxSetStatus" "ImageCropBBoxSetStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedBBoxVersionIds" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "lastBBoxChangeAt" TIMESTAMP(3),
    "lastBBoxVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageCropWorkflowState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImageCropWorkflowState_imageId_key" ON "ImageCropWorkflowState"("imageId");
CREATE INDEX "ImageCropWorkflowState_projectId_bboxSetStatus_idx" ON "ImageCropWorkflowState"("projectId", "bboxSetStatus");
CREATE INDEX "ImageCropWorkflowState_confirmedById_idx" ON "ImageCropWorkflowState"("confirmedById");
CREATE INDEX "ImageCropWorkflowState_lastBBoxVersionId_idx" ON "ImageCropWorkflowState"("lastBBoxVersionId");

ALTER TABLE "ImageCropWorkflowState"
  ADD CONSTRAINT "ImageCropWorkflowState_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImageCropWorkflowState"
  ADD CONSTRAINT "ImageCropWorkflowState_imageId_fkey"
  FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImageCropWorkflowState"
  ADD CONSTRAINT "ImageCropWorkflowState_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
