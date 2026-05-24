DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ReviewDecision"
    WHERE num_nonnulls("artifactVersionId", "sliceClassificationVersionId") <> 1
  ) THEN
    RAISE EXCEPTION 'RB-109 preflight failed: ReviewDecision rows must reference exactly one review target';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ExportItem"
    WHERE
      (
        role = 'image'
        AND NOT (
          "imageId" IS NOT NULL
          AND "artifactVersionId" IS NULL
          AND "sliceClassificationVersionId" IS NULL
          AND "derivedCropId" IS NULL
        )
      )
      OR (
        role IN ('semantic-mask', 'support-mask')
        AND NOT (
          "imageId" IS NOT NULL
          AND "artifactVersionId" IS NOT NULL
          AND "sliceClassificationVersionId" IS NULL
          AND "predictionProvenanceId" IS NULL
          AND "derivedCropId" IS NULL
        )
      )
      OR (
        role = 'slice-classification'
        AND NOT (
          "imageId" IS NOT NULL
          AND "artifactVersionId" IS NULL
          AND "sliceClassificationVersionId" IS NOT NULL
          AND "predictionProvenanceId" IS NULL
          AND "derivedCropId" IS NULL
        )
      )
      OR (
        role IN ('original-image', 'derived-crop')
        AND NOT (
          "imageId" IS NOT NULL
          AND "artifactVersionId" IS NULL
          AND "sliceClassificationVersionId" IS NULL
          AND "predictionProvenanceId" IS NULL
          AND "derivedCropId" IS NOT NULL
        )
      )
      OR (
        role IN ('crop-semantic-mask', 'crop-support-mask')
        AND NOT (
          "imageId" IS NOT NULL
          AND "artifactVersionId" IS NOT NULL
          AND "sliceClassificationVersionId" IS NULL
          AND "predictionProvenanceId" IS NULL
          AND "derivedCropId" IS NOT NULL
        )
      )
      OR (
        role = 'crop-slice-classification'
        AND NOT (
          "imageId" IS NOT NULL
          AND "artifactVersionId" IS NULL
          AND "sliceClassificationVersionId" IS NOT NULL
          AND "predictionProvenanceId" IS NULL
          AND "derivedCropId" IS NOT NULL
        )
      )
      OR (
        role = 'prediction-proposal'
        AND NOT (
          "imageId" IS NOT NULL
          AND "sliceClassificationVersionId" IS NULL
          AND "predictionProvenanceId" IS NOT NULL
          AND "derivedCropId" IS NULL
        )
      )
      OR (
        role = 'human-correction-reference'
        AND NOT (
          "imageId" IS NOT NULL
          AND "artifactVersionId" IS NOT NULL
          AND "sliceClassificationVersionId" IS NULL
          AND "predictionProvenanceId" IS NOT NULL
          AND "derivedCropId" IS NULL
        )
      )
      OR (
        role = 'approved-ground-truth-reference'
        AND NOT (
          "imageId" IS NOT NULL
          AND num_nonnulls("artifactVersionId", "sliceClassificationVersionId") = 1
          AND "predictionProvenanceId" IS NOT NULL
          AND "derivedCropId" IS NULL
        )
      )
  ) THEN
    RAISE EXCEPTION 'RB-109 preflight failed: ExportItem rows violate the constrained role/reference matrix';
  END IF;
END
$$;

ALTER TABLE "ReviewDecision"
  ADD CONSTRAINT "ReviewDecision_exactly_one_target_chk"
  CHECK (num_nonnulls("artifactVersionId", "sliceClassificationVersionId") = 1);

ALTER TABLE "ExportItem"
  ADD CONSTRAINT "ExportItem_image_reference_chk"
  CHECK (
    role <> 'image'
    OR (
      "imageId" IS NOT NULL
      AND "artifactVersionId" IS NULL
      AND "sliceClassificationVersionId" IS NULL
      AND "derivedCropId" IS NULL
    )
  );

ALTER TABLE "ExportItem"
  ADD CONSTRAINT "ExportItem_full_image_artifact_reference_chk"
  CHECK (
    role NOT IN ('semantic-mask', 'support-mask')
    OR (
      "imageId" IS NOT NULL
      AND "artifactVersionId" IS NOT NULL
      AND "sliceClassificationVersionId" IS NULL
      AND "predictionProvenanceId" IS NULL
      AND "derivedCropId" IS NULL
    )
  );

ALTER TABLE "ExportItem"
  ADD CONSTRAINT "ExportItem_full_image_classification_reference_chk"
  CHECK (
    role <> 'slice-classification'
    OR (
      "imageId" IS NOT NULL
      AND "artifactVersionId" IS NULL
      AND "sliceClassificationVersionId" IS NOT NULL
      AND "predictionProvenanceId" IS NULL
      AND "derivedCropId" IS NULL
    )
  );

ALTER TABLE "ExportItem"
  ADD CONSTRAINT "ExportItem_crop_asset_reference_chk"
  CHECK (
    role NOT IN ('original-image', 'derived-crop')
    OR (
      "imageId" IS NOT NULL
      AND "artifactVersionId" IS NULL
      AND "sliceClassificationVersionId" IS NULL
      AND "predictionProvenanceId" IS NULL
      AND "derivedCropId" IS NOT NULL
    )
  );

ALTER TABLE "ExportItem"
  ADD CONSTRAINT "ExportItem_crop_artifact_reference_chk"
  CHECK (
    role NOT IN ('crop-semantic-mask', 'crop-support-mask')
    OR (
      "imageId" IS NOT NULL
      AND "artifactVersionId" IS NOT NULL
      AND "sliceClassificationVersionId" IS NULL
      AND "predictionProvenanceId" IS NULL
      AND "derivedCropId" IS NOT NULL
    )
  );

ALTER TABLE "ExportItem"
  ADD CONSTRAINT "ExportItem_crop_classification_reference_chk"
  CHECK (
    role <> 'crop-slice-classification'
    OR (
      "imageId" IS NOT NULL
      AND "artifactVersionId" IS NULL
      AND "sliceClassificationVersionId" IS NOT NULL
      AND "predictionProvenanceId" IS NULL
      AND "derivedCropId" IS NOT NULL
    )
  );

ALTER TABLE "ExportItem"
  ADD CONSTRAINT "ExportItem_prediction_proposal_reference_chk"
  CHECK (
    role <> 'prediction-proposal'
    OR (
      "imageId" IS NOT NULL
      AND "sliceClassificationVersionId" IS NULL
      AND "predictionProvenanceId" IS NOT NULL
      AND "derivedCropId" IS NULL
    )
  );

ALTER TABLE "ExportItem"
  ADD CONSTRAINT "ExportItem_human_correction_reference_chk"
  CHECK (
    role <> 'human-correction-reference'
    OR (
      "imageId" IS NOT NULL
      AND "artifactVersionId" IS NOT NULL
      AND "sliceClassificationVersionId" IS NULL
      AND "predictionProvenanceId" IS NOT NULL
      AND "derivedCropId" IS NULL
    )
  );

ALTER TABLE "ExportItem"
  ADD CONSTRAINT "ExportItem_approved_ground_truth_reference_chk"
  CHECK (
    role <> 'approved-ground-truth-reference'
    OR (
      "imageId" IS NOT NULL
      AND num_nonnulls("artifactVersionId", "sliceClassificationVersionId") = 1
      AND "predictionProvenanceId" IS NOT NULL
      AND "derivedCropId" IS NULL
    )
  );
