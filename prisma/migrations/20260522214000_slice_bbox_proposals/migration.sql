-- RB-086: versioned BBox proposals in source-image pixel coordinates.

ALTER TYPE "CoordinateSpace" ADD VALUE 'SOURCE_IMAGE_PIXEL';

CREATE TYPE "SliceBoundingBoxStatus" AS ENUM ('ACTIVE', 'DELETED');

CREATE TABLE "SliceBoundingBoxVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "sliceInstanceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "SliceBoundingBoxStatus" NOT NULL DEFAULT 'ACTIVE',
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "coordinateSpace" "CoordinateSpace" NOT NULL DEFAULT 'SOURCE_IMAGE_PIXEL',
    "provenance" "ArtifactProvenance" NOT NULL DEFAULT 'HUMAN_ANNOTATION',
    "metadataJson" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SliceBoundingBoxVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SliceBoundingBoxVersion_sliceInstanceId_version_key" ON "SliceBoundingBoxVersion"("sliceInstanceId", "version");
CREATE INDEX "SliceBoundingBoxVersion_projectId_status_idx" ON "SliceBoundingBoxVersion"("projectId", "status");
CREATE INDEX "SliceBoundingBoxVersion_imageId_status_idx" ON "SliceBoundingBoxVersion"("imageId", "status");
CREATE INDEX "SliceBoundingBoxVersion_sliceInstanceId_status_idx" ON "SliceBoundingBoxVersion"("sliceInstanceId", "status");
CREATE INDEX "SliceBoundingBoxVersion_createdById_idx" ON "SliceBoundingBoxVersion"("createdById");

ALTER TABLE "SliceBoundingBoxVersion" ADD CONSTRAINT "SliceBoundingBoxVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SliceBoundingBoxVersion" ADD CONSTRAINT "SliceBoundingBoxVersion_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SliceBoundingBoxVersion" ADD CONSTRAINT "SliceBoundingBoxVersion_sliceInstanceId_fkey" FOREIGN KEY ("sliceInstanceId") REFERENCES "SliceInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SliceBoundingBoxVersion" ADD CONSTRAINT "SliceBoundingBoxVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
