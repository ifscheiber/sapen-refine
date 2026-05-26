# EX-004 — Crop Semantic Training Dataset Snapshot

## Status

Planned

## Priority

P1

## Type

Training Data / Semantic Segmentation / Crop Workflow / Manifest

## Repository

`sapen-annotate`

## Read-only dependency

`../sapen-cnn` may be inspected for semantic dataset compatibility, but must not be modified.

## Depends on

- EX-001 — SaPen-CNN Training Dataset Snapshot Contract
- EX-002 — Manifest-Only Training Dataset Snapshot Mode
- Current crop training export implementation
- Current crop semantic/support mask workflow

## Blocks

- EX-005 — Annotate-Side Local SaPen-CNN Dataset Materializer

---

## 1. Context

Semantic-segmentation models in `sapen-cnn` should be trained on crop images, not whole source images.

The authoritative crop data already exists in `sapen-annotate`:

- `DerivedSliceCrop` stores the crop image in object storage.
- Approved crop-space `SEMANTIC_MASK` versions store the semantic labels.
- `cropSemanticMode` separates Sap/Heartwood and Copper annotation families.
- Existing crop readiness logic ensures lineage, coordinate space, dimensions, approval and classification consistency.

The current `crop_training` export is close, but it is still ZIP/package-oriented and not yet explicitly shaped as a `sapen-cnn` training snapshot with task-specific semantic masks and split assignments.

---

## 2. Goal

Implement or extend the manifest builder for crop semantic segmentation training snapshots.

The manifest must contain `cropSemanticItems[]` for two task families:

```text
SAP_HEARTWOOD_SEMSEG
COPPER_SEMSEG
```

Each item must reference:

- the derived crop image,
- the approved crop-space semantic mask,
- optional/required support geometry provenance,
- label schema and task-specific remapping,
- split assignment,
- checksums/dimensions/coordinate space/provenance.

This ticket prepares the data contract for EX-005 local materialization into current `sapen-cnn` directory layouts.

---

## 3. Source selection rules

Use only candidates from `resolveCropWorkflowReadiness()` with:

```text
readinessStatus = READY
approved semantic mask present
approved classification present
coordinateSpace = CROP_PIXEL
mask dimensions = crop dimensions
valid checksum/size metadata
```

Skip all other candidates with explicit `skippedItems[]` entries and reasons.

### Sap/Heartwood items

Include items where:

```text
semanticMask.cropSemanticMode = SAP_HEARTWOOD
classification.class = SAP_HEARTWOOD_SLICE
```

Support geometry:

- `supportGeometrySource = SEMANTIC_FOREGROUND` is allowed and expected for supportless Sap/Heartwood crop items.
- No explicit support mask is required for Sap/Heartwood when semantic foreground is the support geometry source.

### Copper items

Include items where:

```text
semanticMask.cropSemanticMode = COPPER
classification.class = COPPER_SLICE
```

Support geometry:

- Explicit approved crop `SLICE_SUPPORT_MASK` is required for Copper crop items.
- Copper semantic pixels must never be exported as support geometry.

---

## 4. Label mapping contract

`src/mask/labels.ts` currently defines:

```text
0  background
1  sapwood
2  heartwood
3  copper
4  unknown
10 slice support
```

The crop semantic snapshot must define task-specific remapping for materialization:

### SAP_HEARTWOOD_SEMSEG

```text
raw 0 -> 0 background
raw 1 -> 1 sapwood
raw 2 -> 2 heartwood
raw 3 -> invalid/exclude item unless explicit warning policy says set to background
raw 4 -> invalid/exclude item unless explicit warning policy says set to background
raw 10 -> invalid/exclude item
```

Default policy: invalid family labels in a READY Sap/Heartwood semantic mask should not occur. If detected by byte inspection, fail or skip the item with a warning instead of silently remapping.

### COPPER_SEMSEG

```text
raw 0 -> 0 background
raw 3 -> 1 copper
raw 1/2/4/10 -> invalid/exclude item unless explicitly documented otherwise
```

Default policy: invalid family labels in a READY Copper semantic mask should not occur. If detected, fail or skip with a warning.

---

## 5. Manifest item shape

Each `cropSemanticItems[]` entry should contain at least:

```text
itemId
split
task
sourceImage.id
sourceImage.filename
sourceImage.checksum
sourceImage.width
sourceImage.height
crop.id
crop.version
crop.path/ref
crop.checksum
crop.byteSize
crop.width
crop.height
crop.coordinateSpace = CROP_PIXEL
crop.transformToSource
semanticMask.artifactVersionId
semanticMask.version
semanticMask.path/ref
semanticMask.format = u8raw-v1
semanticMask.width
semanticMask.height
semanticMask.coordinateSpace = CROP_PIXEL
semanticMask.checksum
semanticMask.labelSchemaVersionId
semanticMask.cropSemanticMode
semanticMask.approval
supportGeometry.source
supportMask.artifactVersionId optional/required by mode
classification.classificationVersionId
classification.class
classification.approval
labelMapping
warnings[]
```

Do not expose private storage keys in normal browser responses.

---

## 6. Split/leakage policy

Use the shared split assignment from EX-001/EX-003.

All crop semantic items derived from the same source image/group must remain in the same split as:

- corresponding full-image instance item,
- corresponding classification item.

Minimum group key:

```text
sampleMetadata.tNumber + specimenIdentifier if present,
else sourceImageId
```

---

## 7. Relationship to existing `crop_training` export

Do not remove the existing `crop_training` export behavior.

This ticket may:

- extend it with a `sapen-cnn` manifest section,
- introduce a new internal target for combined SaPen-CNN training snapshots,
- or add a new builder reused by both `crop_training` and future SaPen-CNN snapshots.

Prefer reusing existing crop readiness and manifest helper logic instead of duplicating selection rules.

Keep current ZIP crop package behavior backward-compatible unless EX-002 package mode is explicitly selected.

---

## 8. Non-goals

Do not implement here:

- full-image instance/classification dataset generation,
- local filesystem materialization,
- raw `.u8raw` to PNG/TIFF conversion script,
- `sapen-cnn` code changes,
- training orchestration.

---

## 9. Acceptance criteria

- A crop semantic manifest section exists and is covered by tests.
- Sap/Heartwood and Copper crop semantic items are separated by task.
- Only READY crop candidates are included.
- Sap/Heartwood masks use `SAP_HEARTWOOD` semantic mode and `SAP_HEARTWOOD_SLICE` classification.
- Copper masks use `COPPER` semantic mode and `COPPER_SLICE` classification.
- Copper items require explicit support geometry; Copper semantic masks are never treated as support.
- Task-specific label mappings are recorded in the manifest.
- Invalid family labels are detected or explicitly guarded.
- Split assignments are present and group-stable.
- Existing crop-training export tests still pass.
- No file in `../sapen-cnn` is modified.

---

## 10. Suggested files to inspect/edit

In `sapen-annotate`:

```text
src/server/domain/exports.ts
src/server/domain/cropReadiness.ts
src/server/domain/cropAnnotationFamilies.ts
src/server/domain/cropSemanticFamily.ts
src/mask/labels.ts
docs/06-data/training-export-contract.md
docs/06-data/sapen-cnn-training-dataset-snapshot-contract.md
tests/integration/export-workflow.test.ts
tests/integration/crop-semantic-mask-workflow.test.ts
tests/integration/crop-support-mask-workflow.test.ts
```

Read-only in `../sapen-cnn`:

```text
../sapen-cnn/models/sapen_semseg/data/dataset.py
../sapen-cnn/configs/semseg/heartwood_sapwood_instance_patches_dinov2_multiscale.json
../sapen-cnn/configs/semseg/copper_binary_instance_patches_dinov2.json
```

---

## 11. Validation

Run from `sapen-annotate`:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run test -- tests/integration/export-workflow.test.ts tests/integration/crop-semantic-mask-workflow.test.ts tests/integration/crop-support-mask-workflow.test.ts
```

Add targeted tests for:

- Sap/Heartwood item inclusion,
- Copper item inclusion with support requirement,
- invalid family label guard,
- skipped items and warning reasons,
- split stability,
- sanitized response without private storage keys.

---

## 12. Codex prompt

You are working in `sapen-annotate`. `../sapen-cnn` is read-only and must not be modified.

Implement the crop semantic training dataset manifest section for SaPen-CNN. Use existing crop readiness and include only READY crop candidates. Separate `SAP_HEARTWOOD_SEMSEG` and `COPPER_SEMSEG` items. Record crop image refs, crop-space semantic mask refs, approvals, label schemas, support-geometry provenance, classifications, task-specific label mappings and split assignments. Copper items require explicit support masks; never treat Copper semantic pixels as support. Preserve existing crop-training export behavior and tests. Add targeted tests and docs.
