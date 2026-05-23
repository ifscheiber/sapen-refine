-- RB-087: derived slice crop persistence in crop-pixel coordinates.

ALTER TYPE "CoordinateSpace" ADD VALUE 'CROP_PIXEL';

CREATE TABLE "DerivedSliceCrop" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceImageId" TEXT NOT NULL,
    "sourceImageChecksum" TEXT,
    "sourceImageWidth" INTEGER NOT NULL,
    "sourceImageHeight" INTEGER NOT NULL,
    "sliceInstanceId" TEXT NOT NULL,
    "bboxVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceX" INTEGER NOT NULL,
    "sourceY" INTEGER NOT NULL,
    "sourceWidth" INTEGER NOT NULL,
    "sourceHeight" INTEGER NOT NULL,
    "cropX" INTEGER NOT NULL DEFAULT 0,
    "cropY" INTEGER NOT NULL DEFAULT 0,
    "cropWidth" INTEGER NOT NULL,
    "cropHeight" INTEGER NOT NULL,
    "paddingRequestedPx" INTEGER NOT NULL,
    "paddingAppliedLeftPx" INTEGER NOT NULL,
    "paddingAppliedTopPx" INTEGER NOT NULL,
    "paddingAppliedRightPx" INTEGER NOT NULL,
    "paddingAppliedBottomPx" INTEGER NOT NULL,
    "paddingClipped" BOOLEAN NOT NULL DEFAULT false,
    "coordinateSpace" "CoordinateSpace" NOT NULL DEFAULT 'CROP_PIXEL',
    "transformToSourceJson" JSONB NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT,
    "contentType" TEXT,
    "byteSize" INTEGER NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'png',
    "metadataJson" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DerivedSliceCrop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DerivedSliceCrop_storageKey_key" ON "DerivedSliceCrop"("storageKey");
CREATE UNIQUE INDEX "DerivedSliceCrop_sliceInstanceId_version_key" ON "DerivedSliceCrop"("sliceInstanceId", "version");
CREATE INDEX "DerivedSliceCrop_projectId_createdAt_idx" ON "DerivedSliceCrop"("projectId", "createdAt");
CREATE INDEX "DerivedSliceCrop_sourceImageId_createdAt_idx" ON "DerivedSliceCrop"("sourceImageId", "createdAt");
CREATE INDEX "DerivedSliceCrop_bboxVersionId_createdAt_idx" ON "DerivedSliceCrop"("bboxVersionId", "createdAt");
CREATE INDEX "DerivedSliceCrop_createdById_idx" ON "DerivedSliceCrop"("createdById");

ALTER TABLE "DerivedSliceCrop" ADD CONSTRAINT "DerivedSliceCrop_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DerivedSliceCrop" ADD CONSTRAINT "DerivedSliceCrop_sourceImageId_fkey" FOREIGN KEY ("sourceImageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DerivedSliceCrop" ADD CONSTRAINT "DerivedSliceCrop_sliceInstanceId_fkey" FOREIGN KEY ("sliceInstanceId") REFERENCES "SliceInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DerivedSliceCrop" ADD CONSTRAINT "DerivedSliceCrop_bboxVersionId_fkey" FOREIGN KEY ("bboxVersionId") REFERENCES "SliceBoundingBoxVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DerivedSliceCrop" ADD CONSTRAINT "DerivedSliceCrop_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
