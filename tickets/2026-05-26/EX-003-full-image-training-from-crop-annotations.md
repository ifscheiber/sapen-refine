# EX-003 — Full-Image Training Dataset Derived From Crop Annotations

## Status

Planned

## Priority

P1

## Type

Training Data / Instance Segmentation / Slice Classification / Crop Reprojection / Manifest

## Repository

`sapen-annotate`

## Read-only dependency

`../sapen-cnn` may be inspected to verify the local dataset contract, but must not be modified.

## Depends on

- EX-001 — SaPen-CNN Training Dataset Snapshot Contract
- EX-002 — Manifest-Only Training Dataset Snapshot Mode
- Current crop readiness implementation in `src/server/domain/cropReadiness.ts`
- Current crop coordinate docs in `docs/06-data/coordinate-spaces-and-transforms.md`

## Blocks

- EX-005 — Annotate-Side Local SaPen-CNN Dataset Materializer

---

## 1. Context

We need full source images for training the instance-segmentation and slice-classification models.

However, the authoritative ground truth currently lives in the crop workflow:

- `DerivedSliceCrop` stores crop images and crop-to-source transform metadata.
- Approved crop `SLICE_SUPPORT_MASK` and crop `SEMANTIC_MASK` versions store crop-space masks.
- Approved `SliceClassificationVersion` stores crop-derived slice class labels.
- `resolveCropWorkflowReadiness()` already determines whether a crop is training-ready.

Therefore, full-image training data must be generated from crop annotations:

```text
READY crop candidates
  -> reproject support geometry to source-image pixel space
  -> generate one dense instance-id mask per source image
  -> generate classification rows from source-image bboxes / crop classes
```

Do not rely on manually maintained full-image instance masks.

---

## 2. Goal

Implement the `sapen-annotate` manifest builder for full-image training data derived from crop annotations.

The builder must produce manifest sections for:

1. **Instance segmentation**
   - one source image item per original image,
   - one dense crop-derived instance mask description per source image,
   - deterministic instance id mapping.

2. **Slice classification**
   - one classification item per approved crop classification,
   - source image path/ref plus source-image bbox,
   - optional crop image ref,
   - label mapped to current `sapen-cnn` classifier labels.

This ticket may produce manifest data only, or may add export-prefix derived-object placeholders if EX-005 will materialize locally. Do not build the local materializer in this ticket.

---

## 3. Source selection rules

Use only crop candidates from `resolveCropWorkflowReadiness()` with:

```text
readinessStatus = READY
approved semantic mask present
approved classification present
supportGeometrySource present
```

Support geometry rules:

### Copper crops

- `cropSemanticMode = COPPER` requires explicit approved crop `SLICE_SUPPORT_MASK`.
- Reproject the approved support mask as physical slice/object support.
- Do not derive support from copper semantic pixels.

### Sap/Heartwood crops

- `cropSemanticMode = SAP_HEARTWOOD` may use `SEMANTIC_FOREGROUND` as support geometry according to the current readiness policy.
- Reproject non-background Sapwood/Heartwood pixels as the physical slice/object support for instance segmentation.

### Exclusions

Exclude crop candidates with:

```text
PARTIAL
NOT_READY
REVIEW_REQUIRED
UNKNOWN classification
REVIEW_REQUIRED classification
lineage mismatch
coordinate mismatch
missing integrity metadata
semantic family conflict
classification/semantic family mismatch
```

Include excluded items in `skippedItems[]` with reasons.

---

## 4. Full-image instance-mask derivation contract

For each source image:

1. Group all eligible READY crop candidates by `sourceImageId`.
2. Allocate deterministic instance ids within that image:

```text
0 = background
1..N = crop-derived slice instances sorted by sourceY, sourceX, sliceInstanceId, cropId
```

3. For each crop candidate:
   - load or reference its crop support geometry source,
   - reproject crop pixels to source-image pixels using the integer translation transform from `DerivedSliceCrop.transformToSourceJson` / `sourceX` / `sourceY`,
   - write that crop's foreground pixels into the dense source-image instance mask using the allocated instance id.

4. Detect overlaps/conflicts:
   - If two crop foreground regions overlap in source-image space, do not silently overwrite.
   - Add a deterministic warning with crop ids and pixel count.
   - Prefer excluding the conflicting crop or the entire source image from training until reviewed, unless a product decision explicitly chooses a conflict policy.

5. Record provenance:

```text
sourceImageId
sourceImageChecksum
sourceImageWidth/sourceImageHeight
instanceMask.derivation = CROP_REPROJECTED_SUPPORT_GEOMETRY
sourceCropIds[]
sourceArtifactVersionIds[]
sourceClassificationVersionIds[]
instanceIdMap[]
coordinateSpace = SOURCE_IMAGE_PIXEL
```

---

## 5. Instance-mask encoding compatibility

Because this ticket is in `sapen-annotate` and must not modify `../sapen-cnn`, the output contract must respect the current `sapen-cnn` loader behavior.

Codex must inspect read-only:

```text
../sapen-cnn/models/sapen_instseg/data/dataset.py
```

and document/validate the safest mask file representation.

Known risk to verify:

- If `sapen-cnn` normalizes 8-bit `L` masks before converting to `long`, instance ids may collapse to zero.
- If so, do not specify 8-bit PNG as the default instance-mask materialization format.
- Prefer a format that preserves integer ids with the current loader, such as integer TIFF mode `I`, if verified.
- If no safe format exists without changing `sapen-cnn`, create a documented follow-up ticket for the future `sapen-cnn` loader fix, but do not edit `../sapen-cnn` here.

This ticket should add tests for the chosen encoding if materialized objects are generated in `sapen-annotate`; otherwise EX-005 must test it in the local materializer.

---

## 6. Slice classification manifest contract

For each eligible READY crop candidate with approved classification:

Map labels:

```text
SliceClass.COPPER_SLICE        -> COPPER
SliceClass.SAP_HEARTWOOD_SLICE -> HEARTWOOD_STAINED
SliceClass.UNKNOWN             -> exclude by default
SliceClass.REVIEW_REQUIRED     -> exclude by default
```

Each classification item must include enough data to write a current `sapen-cnn` CSV row:

```text
source_image_path
bbox_x0
bbox_y0
bbox_x1
bbox_y1
label
```

Use the crop's actual source rectangle for reproducible equivalence with the stored crop:

```text
bbox_x0 = derivedCrop.sourceX
bbox_y0 = derivedCrop.sourceY
bbox_x1 = derivedCrop.sourceX + derivedCrop.sourceWidth
bbox_y1 = derivedCrop.sourceY + derivedCrop.sourceHeight
```

Also record the original `SliceBoundingBoxVersion` in provenance.

If `crop_path` is available/materialized later, -EX-005 may use `crop_path,label` instead. This ticket should preserve both options in the manifest.

---

## 7. Split/leakage policy

The full-image instance items and classification items must use the shared split assignment defined in EX-001.

Minimum grouping:

```text
groupKey = sampleMetadata.tNumber + specimenIdentifier if present,
           else sourceImageId
```

All crops and the full image derived from one source image/group must be in the same split.

The manifest must include the split per:

- `fullImageItems[]`,
- `classificationItems[]`,
- skipped items where applicable.

---

## 8. Non-goals

Do not implement here:

- crop semantic dataset generation,
- local filesystem materialization,
- `sapen-cnn` code changes,
- model training runs,
- UI-heavy dataset builder,
- ZIP package replacement beyond manifest integration from EX-002.

---

## 9. Acceptance criteria

- A new full-image training manifest builder exists or the existing export builder is extended cleanly.
- The builder uses crop readiness and includes only READY crop candidates.
- The builder groups eligible crops by source image.
- The manifest contains `fullImageItems[]` with deterministic instance-id provenance.
- The manifest contains `classificationItems[]` with source-image bbox and mapped `sapen-cnn` labels.
- Excluded crops/images are listed with explicit reasons.
- The contract clearly states that full-image instance masks and classification labels are derived from crop annotations.
- Overlap/conflict handling is explicit and tested/documented.
- Private storage keys are not exposed to normal browser responses.
- No file in `../sapen-cnn` is modified.

---

## 10. Suggested files to inspect/edit

In `sapen-annotate`:

```text
src/server/domain/exports.ts
src/server/domain/cropReadiness.ts
src/server/domain/exportObjectIntegrity.ts
src/server/storage/s3.ts
docs/06-data/sapen-cnn-training-dataset-snapshot-contract.md
docs/06-data/training-export-contract.md
tests/integration/export-workflow.test.ts
tests/integration/crop-semantic-mask-workflow.test.ts
tests/integration/crop-support-mask-workflow.test.ts
tests/integration/slice-bbox-workflow.test.ts
```

Read-only in `../sapen-cnn`:

```text
../sapen-cnn/models/sapen_instseg/data/dataset.py
../sapen-cnn/models/sapen_clsf/dataset.py
../sapen-cnn/configs/instseg/*.json
../sapen-cnn/configs/clsf/*.json
```

---

## 11. Validation

Run from `sapen-annotate`:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run test -- tests/integration/export-workflow.test.ts tests/integration/crop-semantic-mask-workflow.test.ts tests/integration/crop-support-mask-workflow.test.ts tests/integration/slice-bbox-workflow.test.ts
```

Add targeted tests for:

- deterministic instance id allocation,
- crop-to-source reprojection using integer translation,
- source-image grouping,
- classification label mapping,
- skipped conflict/missing-review cases,
- storage refs not exposed in normal sanitized responses.

---

## 12. Codex prompt

You are working in `sapen-annotate`. `../sapen-cnn` is read-only and must not be modified.

Implement the full-image training dataset manifest builder derived from crop annotations. Use `resolveCropWorkflowReadiness()` and include only READY crop candidates. Generate manifest data for source-image instance segmentation by grouping crops per source image and defining deterministic crop-derived instance masks/provenance. Generate classification manifest items from approved crop classifications and map `COPPER_SLICE -> COPPER`, `SAP_HEARTWOOD_SLICE -> HEARTWOOD_STAINED`; exclude UNKNOWN/REVIEW_REQUIRED by default. Use crop source rectangles for classifier bbox rows and record original bbox/crop provenance. Verify current `sapen-cnn` instance/classification dataset expectations by read-only inspection, especially mask encoding compatibility, but do not change `sapen-cnn`. Add tests and docs.
