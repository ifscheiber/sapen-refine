-- Persist version-scoped mask statistics for crop readiness/family checks.
ALTER TABLE "AnnotationArtifactVersion"
  ADD COLUMN "metadataJson" JSONB;
