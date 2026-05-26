# EX-001 — SaPen-CNN Training Dataset Snapshot Contract

## Status

Planned

## Priority

P1

## Type

Architecture / Data Contract / Training Handoff / Documentation

## Repository

`sapen-annotate`

## Read-only dependency

`../sapen-cnn` may be inspected to verify dataset expectations, but must not be modified in this ticket.

## Depends on

- Current crop workflow and crop readiness implementation
- Current export implementation in `src/server/domain/exports.ts`
- Current crop readiness implementation in `src/server/domain/cropReadiness.ts`
- Current training export documentation in `docs/06-data/training-export-contract.md`

## Blocks

- EX-002 — Manifest-only Training Dataset Snapshot Mode
- EX-003 — Full-Image Training Dataset Derived From Crop Annotations
- EX-004 — Crop Semantic Training Dataset Snapshot
- EX-005 — Annotate-Side Local SaPen-CNN Dataset Materializer

---

## 1. Context

The next open work package in `sapen-annotate` is the handoff of annotated data to `sapen-cnn` for local model training.

Important product decision:

- We are currently working in `sapen-annotate`.
- Codex has read-only access to `../sapen-cnn` from the `sapen-annotate` repo.
- Do not implement changes in `../sapen-cnn` in this sprint.
- `sapen-annotate` is the source of truth for approved images, crops, masks, classifications, metadata, provenance and checksums.
- The binary image/mask data lives in IONOS/S3-compatible object storage.
- Training happens locally.

Clarification of the required dataset families:

1. **Full-image training data** for instance segmentation and slice classification.
   - Use whole source images.
   - Derive the dense instance masks from approved crop annotations in `sapen-annotate`.
   - Derive classification items from approved crop classifications in `sapen-annotate`.
   - Do not depend on manually maintained full-image instance masks.

2. **Crop training data** for semantic segmentation.
   - Use derived crop images.
   - Use approved crop-space semantic masks.
   - Produce task-specific masks for Sapwood/Heartwood and Copper semantic segmentation.

A classic ZIP export can remain useful for backup/audit/manual handoff, but it must not be the primary training-data architecture. The primary architecture should be a reproducible manifest-backed dataset snapshot plus direct object-storage access/materialization.

---

## 2. Goal

Create the authoritative contract documentation for a `sapen-annotate` → `sapen-cnn` training dataset snapshot.

The contract must define:

- the dataset families,
- source-of-truth rules,
- manifest shape,
- object reference strategy,
- split/leakage policy,
- label mappings,
- coordinate-space rules,
- required integrity metadata,
- generated local filesystem layouts compatible with current `sapen-cnn`,
- and explicit boundaries for future `sapen-cnn` changes.

Suggested document:

```text
custom-docs-or-existing-docs/06-data/sapen-cnn-training-dataset-snapshot-contract.md
```

or, if the existing structure should be extended instead:

```text
docs/06-data/training-export-contract.md
```

Prefer a dedicated new document and link it from `docs/06-data/training-export-contract.md`.

---

## 3. Required read-only `sapen-cnn` compatibility check

Inspect, but do not edit:

```text
../sapen-cnn/models/sapen_instseg/data/dataset.py
../sapen-cnn/models/sapen_clsf/dataset.py
../sapen-cnn/models/sapen_semseg/data/dataset.py
../sapen-cnn/configs/instseg/*.json
../sapen-cnn/configs/clsf/*.json
../sapen-cnn/configs/semseg/*.json
../sapen-cnn/docs/runbooks/*.md
```

Document the observed current expectations:

### Instance segmentation

Current `sapen-cnn` expects local directories with matching stems:

```text
<dataset>/instseg/train/images/<stem>.<image-ext>
<dataset>/instseg/train/masks/<stem>.<mask-ext>
<dataset>/instseg/val/images/<stem>.<image-ext>
<dataset>/instseg/val/masks/<stem>.<mask-ext>
```

The mask is a dense instance-id image with:

```text
0 = background
1..N = slice instance ids within that source image
```

Important compatibility note to document:

- The current instance dataset uses the same Pillow loader for images and masks.
- Verify whether 8-bit `L` masks are normalized before conversion to `long` in the current loader.
- If normalization would destroy instance ids, the contract must require a mask encoding that preserves ids with the current loader, e.g. integer TIFF mode `I`, or explicitly document that a later `sapen-cnn` loader fix is required.
- Since this sprint must not modify `../sapen-cnn`, the `sapen-annotate` contract/materializer must choose the safest currently compatible representation.

### Slice classification

Current `sapen-cnn` supports a CSV manifest. Each row can contain either:

```text
crop_path,label,...
```

or:

```text
source_image_path,bbox_x0,bbox_y0,bbox_x1,bbox_y1,label,...
```

The existing classifier config uses:

```text
class_names = ["COPPER", "HEARTWOOD_STAINED"]
```

The contract must define this mapping:

```text
COPPER_SLICE        -> COPPER
SAP_HEARTWOOD_SLICE -> HEARTWOOD_STAINED
UNKNOWN             -> excluded from training by default
REVIEW_REQUIRED     -> excluded from training by default
```

### Semantic segmentation

Current `sapen-cnn` expects local directories with matching stems:

```text
<dataset>/semseg/<task>/train/images/<stem>.<image-ext>
<dataset>/semseg/<task>/train/masks/<stem>.<mask-ext>
<dataset>/semseg/<task>/val/images/<stem>.<image-ext>
<dataset>/semseg/<task>/val/masks/<stem>.<mask-ext>
```

The contract must define task-specific target masks:

Sapwood/Heartwood:

```text
0 = background
1 = sapwood
2 = heartwood
```

Copper:

```text
0 = background
1 = copper
```

---

## 4. Dataset snapshot families

Define one manifest version, for example:

```text
sapen-annotate-cnn-training-dataset-v1
```

The manifest should support these sections:

```text
manifestVersion
snapshotId / exportId
createdAt
createdBy
project
selection
labelSchemas
splitPolicy
objectAccess
fullImageItems
classificationItems
cropSemanticItems
skippedItems
warnings
summary
```

### 4.1 Full-image instance segmentation items

Each `fullImageItems[]` entry represents one original source image and the crop-derived training targets for that image.

Required fields:

```text
sourceImage.id
sourceImage.filename
sourceImage.storageRef or package path / local materialization path
sourceImage.contentType
sourceImage.size
sourceImage.width
sourceImage.height
sourceImage.checksum
sourceImage.sampleMetadata
sourceImage.acquisitionMetadata
instanceMask.derivation = CROP_REPROJECTED_SUPPORT_GEOMETRY
instanceMask.format
instanceMask.width
instanceMask.height
instanceMask.checksum if materialized
instanceMask.sourceCropIds[]
instanceMask.sourceSliceInstanceIds[]
instanceMask.instanceIdMap[]
sourceCropRefs[]
warnings[]
split
```

The dense instance mask must be derived from crop workflow candidates only.

Support geometry source rules:

- `Copper` crop items require an explicit approved crop `SLICE_SUPPORT_MASK`.
- `Sap/Heartwood` crop items may use `SEMANTIC_FOREGROUND` as support geometry according to the existing crop readiness policy.
- Copper semantic pixels must never be treated as physical support geometry.

### 4.2 Classification items

Each `classificationItems[]` entry represents one crop-derived classification sample.

Required fields:

```text
sourceImage.id
sourceImage.path/ref
crop.id
sliceInstanceId
bbox.sourceRect or derivedCrop.sourceRect
bbox.originalBBoxVersion
crop.path/ref optional
classification.versionId
classification.class
classification.sapenCnnLabel
classification.reviewState
classification.approval
split
warnings[]
```

Prefer storing enough data to support both current `sapen-cnn` CSV modes:

- `crop_path,label`
- `source_image_path,bbox_x0,bbox_y0,bbox_x1,bbox_y1,label`

### 4.3 Crop semantic segmentation items

Each `cropSemanticItems[]` entry represents one crop image and one approved crop-space semantic mask.

Required fields:

```text
task = SAP_HEARTWOOD_SEMSEG | COPPER_SEMSEG
sourceImage.id
crop.id
crop.path/ref
semanticMask.versionId
semanticMask.rawFormat = u8raw-v1
semanticMask.width
semanticMask.height
semanticMask.coordinateSpace = CROP_PIXEL
semanticMask.cropSemanticMode
semanticMask.labelMappingForSapenCnn
supportGeometrySource
split
warnings[]
```

---

## 5. Split and leakage policy

Define a deterministic split policy. Do not split individual crops randomly without grouping.

Minimum grouping rule:

```text
groupKey = sampleMetadata.tNumber + specimenIdentifier if present,
           else sourceImageId
```

All items derived from the same group must stay in the same split across:

- full-image instance segmentation,
- slice classification,
- crop semantic segmentation.

The manifest must record:

```text
splitPolicy.seed
splitPolicy.ratios
splitPolicy.groupKeyStrategy
split assignments per item
```

Default split suggestion:

```text
train: 0.8
val:   0.2
test:  optional/deferred unless enough groups exist
```

---

## 6. Non-goals

Do not implement in this ticket:

- export execution logic,
- local dataset materialization,
- S3 download scripts,
- ZIP replacement,
- UI changes,
- `sapen-cnn` code changes,
- model training orchestration.

This ticket is the contract/design/documentation foundation only.

---

## 7. Acceptance criteria

- A dedicated contract document exists and is linked from the existing training export documentation.
- The contract clearly distinguishes full-image instance/classification datasets from crop semantic datasets.
- The contract explicitly states that full-image instance masks and classification items are derived from crop annotations.
- The contract explicitly states that crop semantic datasets use crop images and crop-space semantic masks.
- The contract documents read-only `../sapen-cnn` compatibility observations.
- The contract documents the instance-mask encoding risk in the current `sapen-cnn` loader and defines the chosen no-`sapen-cnn`-change workaround or required future follow-up.
- The contract documents label mappings for instance segmentation, classification, Sap/Heartwood semseg and Copper semseg.
- The contract documents split/leakage policy.
- The contract documents that ZIP exports remain optional transport/backup artifacts and not the primary training architecture.

---

## 8. Validation

Run from `sapen-annotate`:

```bash
git status --short
npm run lint
npm run typecheck
npm run test -- tests/integration/export-workflow.test.ts tests/integration/crop-semantic-mask-workflow.test.ts tests/integration/crop-support-mask-workflow.test.ts tests/integration/slice-bbox-workflow.test.ts
npm run test -- --runInBand tests/unit/mask-serialize.test.ts
```

If documentation-only changes do not require all tests locally, still run at least:

```bash
npm run lint
npm run typecheck
```

---

## 9. Codex prompt

You are working in `sapen-annotate`. The adjacent `../sapen-cnn` repository is read-only. Do not edit any file in `../sapen-cnn`.

Create the SaPen-CNN training dataset snapshot contract for `sapen-annotate`. Carefully inspect the current `sapen-cnn` dataset loaders/configs to document the expected local filesystem shapes and label formats, but make all changes only in `sapen-annotate`. The contract must distinguish: full source images with crop-derived instance masks/classification items for instance/classification training; and crop images with crop-space semantic masks for semantic-segmentation training. Include split/leakage policy, label mappings, coordinate-space rules, object-storage access strategy, and the no-ZIP primary training handoff decision. Preserve the existing training export contract and link the new document from it.
