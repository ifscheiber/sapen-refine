-- Allow review decisions to target either annotation artifact versions or
-- slice classification versions. The exact-one-target invariant is enforced
-- in the review domain service.
ALTER TABLE "ReviewDecision" ALTER COLUMN "artifactVersionId" DROP NOT NULL;

ALTER TABLE "ReviewDecision" ADD COLUMN "sliceClassificationVersionId" TEXT;

CREATE INDEX "ReviewDecision_sliceClassificationVersionId_idx"
  ON "ReviewDecision"("sliceClassificationVersionId");

ALTER TABLE "ReviewDecision"
  ADD CONSTRAINT "ReviewDecision_sliceClassificationVersionId_fkey"
  FOREIGN KEY ("sliceClassificationVersionId")
  REFERENCES "SliceClassificationVersion"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
