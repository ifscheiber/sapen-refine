-- CreateTable
CREATE TABLE "ImageAnnotationReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "state" "ArtifactReviewState" NOT NULL DEFAULT 'DRAFT',
    "snapshotJson" JSONB,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "comments" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageAnnotationReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageAnnotationReview_imageId_key" ON "ImageAnnotationReview"("imageId");

-- CreateIndex
CREATE INDEX "ImageAnnotationReview_projectId_state_idx" ON "ImageAnnotationReview"("projectId", "state");

-- CreateIndex
CREATE INDEX "ImageAnnotationReview_submittedById_idx" ON "ImageAnnotationReview"("submittedById");

-- CreateIndex
CREATE INDEX "ImageAnnotationReview_reviewedById_idx" ON "ImageAnnotationReview"("reviewedById");

-- AddForeignKey
ALTER TABLE "ImageAnnotationReview" ADD CONSTRAINT "ImageAnnotationReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AnnotationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAnnotationReview" ADD CONSTRAINT "ImageAnnotationReview_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAnnotationReview" ADD CONSTRAINT "ImageAnnotationReview_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAnnotationReview" ADD CONSTRAINT "ImageAnnotationReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
