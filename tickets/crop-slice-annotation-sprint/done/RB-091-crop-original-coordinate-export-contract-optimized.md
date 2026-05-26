# RB-091 — Crop / Original Coordinate Export Contract

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Export / Manifest / Coordinate Transform / Training Data / Lineage / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-085 — Crop-Based Slice Annotation Workflow ADR / Design
- RB-086 — BBox Slice Proposal Workflow
- RB-087 — Derived Slice Crop Generation
- RB-088 — Crop Editor: Mandatory Pixel-Perfect Slice Support Mask
- RB-089 — Crop-Constrained Semantic Annotation
- RB-090 — Auto Slice Classification from Semantic Masks

## Blocks

- RB-092 — Crop Workflow Review / Approval Integration
- Crop-based training data handoff
- Future crop-aware model training workflows

---

## 1. Context

RB-090 implemented auto slice classification from crop semantic masks:

- `SliceClassificationVersion` now has classification source/provenance and semantic/support/crop lineage;
- crop semantic masks can trigger save-time auto classification;
- manual override exists through `/api/slices/[sliceInstanceId]/classification`;
- classification provenance is visible in the crop semantic editor;
- auto-derived classifications remain draft suggestions and are not silently export-approved.

RB-091 now extends export contracts so crop-based annotations can be used for training while remaining traceable to the original image.

The current RB-091 draft correctly requires that export packages preserve crop data, original image reference, coordinate transform, slice instance, support mask, semantic mask, classification and review state. It also correctly says prediction-analysis export remains separate and should not be changed unless a later ADR designs crop-aware prediction analysis. fileciteturn34file0

This optimized RB-091 clarifies one important boundary:

```text
RB-091 implements crop-aware export contract, manifest/package layout, lineage validation and candidate readiness metadata.
RB-092 implements the final crop workflow review/readiness UI and policy integration.
```

RB-091 must therefore avoid depending on not-yet-implemented RB-092 behavior.

---

## 2. Goal

Add a crop-aware ground-truth export contract and package layout that preserves crop/original coordinate provenance.

At the end of RB-091:

1. Crop-based support, semantic and classification artifacts can be represented in an export manifest.
2. Each exported crop item is traceable to:
   - original image,
   - original image checksum,
   - `SliceInstance`,
   - `SliceBoundingBoxVersion`,
   - `DerivedSliceCrop`,
   - crop transform,
   - support mask version,
   - semantic mask version,
   - classification version.
3. The manifest clearly distinguishes crop-coordinate masks from original-coordinate references.
4. Existing full-image export behavior remains compatible.
5. Prediction-analysis export semantics remain unchanged.
6. No private storage keys leak.
7. Tests cover transform metadata, lineage consistency and package layout.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- model training,
- SaPen Core integration,
- prediction-analysis crop export,
- model inference,
- export dashboard,
- review/approval redesign,
- final crop readiness UI,
- changing prediction semantics,
- treating crop images as raw uploaded images,
- changing existing full-image export semantics,
- exporting draft/unreviewed data as approved ground truth unless current policy already allows it.

If missing review policy blocks export readiness, record `NOT_READY` / readiness reasons and leave final policy/UI integration to RB-092.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Start with the full validation baseline:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

Because this ticket touches export manifests and package generation, run all existing export tests plus targeted crop export tests before finalizing.

---

## 5. Export Contract Scope

### 5.1 Manifest versioning

Do not silently change the existing training export contract in a breaking way.

Codex must choose one of:

#### Option A — Extend current training export manifest with crop section

Example:

```json
{
  "manifestVersion": "sapen-annotate-training-export-v1",
  "cropItems": []
}
```

Use only if backward compatibility is clearly preserved.

#### Option B — New crop-aware manifest version

Recommended if manifest structure changes materially:

```text
sapen-annotate-training-export-v2
```

or:

```text
sapen-annotate-crop-training-export-v1
```

Preferred for clarity: introduce a distinct crop-aware section or manifest version while keeping existing full-image export behavior available.

Document the decision.

### 5.2 Crop item manifest

Each crop item must include:

```text
projectId
originalImageId
originalImageFilename
originalImageChecksum
originalImageWidth
originalImageHeight

sliceInstanceId
sliceBoundingBoxVersionId
derivedCropId

cropAssetPath
cropChecksum
cropContentType
cropWidth
cropHeight

sourceX
sourceY
sourceWidth
sourceHeight
paddingRequestedPx
paddingAppliedLeftPx
paddingAppliedTopPx
paddingAppliedRightPx
paddingAppliedBottomPx
paddingWasClipped

coordinateSpace = CROP_PIXEL
transformToSource:
  sourceX = cropX + sourceX
  sourceY = cropY + sourceY

supportMaskVersionId
supportMaskPath
supportMaskChecksum
supportMaskCoordinateSpace = CROP_PIXEL
supportReviewState

semanticMaskVersionId
semanticMaskPath
semanticMaskChecksum
semanticMaskCoordinateSpace = CROP_PIXEL
semanticMode
supportMaskVersionIdUsedBySemantic
semanticReviewState

classificationVersionId
classification
classificationSource
derivedFromSemanticMaskVersionId
classificationReviewState

readinessStatus
readinessReasons
```

Exact field names may follow repo conventions.

### 5.3 Readiness in RB-091

RB-091 must not invent a broad new review workflow.

For now, implement a resolver that classifies crop export candidates as:

```text
READY
NOT_READY
PARTIAL
```

with reasons such as:

```text
MISSING_CROP
MISSING_SUPPORT_MASK
MISSING_SEMANTIC_MASK
MISSING_CLASSIFICATION
SUPPORT_NOT_APPROVED
SEMANTIC_NOT_APPROVED
CLASSIFICATION_NOT_APPROVED
LINEAGE_MISMATCH
COORDINATE_SPACE_MISMATCH
```

If crop artifact approval is not fully implemented yet, mark items `NOT_READY` rather than weakening export rules.

RB-092 will later integrate final review/readiness policy and UI.

### 5.4 Lineage consistency

For an item to be export-ready, selected versions must share lineage:

```text
support.derivedCropId === crop.id
semantic.derivedCropId === crop.id
semantic.supportMaskVersionId === support.versionId
classification.derivedFromSemanticMaskVersionId === semantic.versionId
all sliceInstanceIds match
all sourceImageIds match
all coordinateSpace values are CROP_PIXEL where expected
```

If lineage fails, manifest/readiness must record `LINEAGE_MISMATCH`.

### 5.5 Existing full-image export

Existing full-image export must continue to work.

Do not remove or reinterpret previous export targets.

If crop export is added as a new target, keep existing targets stable.

---

## 6. Package Layout

Suggested crop-aware package layout:

```text
manifest.json

original-images/<imageId>.<ext>

crops/<derivedCropId>.png

masks/support-crop/<sliceInstanceId>_<supportVersionId>.u8raw
masks/semantic-crop/<sliceInstanceId>_<semanticVersionId>.u8raw

classifications/<sliceInstanceId>_<classificationVersionId>.json optional

metadata/crop-items/<derivedCropId>.json optional
```

Optional reprojected masks:

```text
masks/support-original/<sliceInstanceId>_<supportVersionId>.u8raw
masks/semantic-original/<sliceInstanceId>_<semanticVersionId>.u8raw
```

Reprojected original-coordinate masks are optional in RB-091. If not implemented, manifest transform metadata must be sufficient to reproject externally.

### 6.1 File contents

- crop image: derived crop PNG generated in RB-087;
- support mask: raw `u8raw-v1` crop-coordinate mask;
- semantic mask: raw `u8raw-v1` crop-coordinate mask;
- classification: manifest fields may be enough; separate JSON optional.

### 6.2 No private storage keys

Manifest and API responses must never expose private storage keys.

Use package-internal relative paths.

---

## 7. Export Service / API Scope

Extend existing export service where appropriate.

Possible approach:

- add crop-aware export target to training export;
- add crop candidate resolver;
- add manifest builder;
- add package writer.

Suggested target name:

```text
crop_training
crop_annotations
crop_ground_truth
```

Use repo naming conventions.

### 7.1 API

If existing export API supports targets/options, add crop target there.

Do not create parallel export infrastructure unless necessary.

### 7.2 UI

Minimal UI update only:

- show crop export target if crop artifacts exist;
- show readiness counts:
  - ready crop items,
  - not-ready crop items,
  - missing support/semantic/classification counts;
- link to docs or readiness explanation.

Do not build review dashboard; RB-092 handles readiness UI integration.

---

## 8. Optional Reprojection Helpers

Add pure transform helpers for reprojecting crop mask coordinates to original image coordinates.

Minimum tests:

```text
crop pixel (0,0) maps to source (sourceX, sourceY)
crop pixel (w-1,h-1) maps to source (sourceX+w-1, sourceY+h-1)
clipped padding has correct source transform
```

If full original-size mask generation is implemented, test:

- output dimensions equal original image dimensions;
- crop mask pixels land in correct original coordinates;
- outside crop is background.

If not implemented, document it as deferred but ensure manifest has sufficient transform metadata.

---

## 9. Tests

### 9.1 Unit tests

Add tests for:

- crop export candidate resolver,
- lineage validation,
- readiness reason generation,
- transform metadata,
- package path generation,
- manifest shape.

### 9.2 Integration tests

Cover:

- crop-aware export includes crop, support, semantic and classification metadata;
- missing support/semantic/classification marks item not ready;
- lineage mismatch marks item not ready;
- existing full-image export still works;
- no prediction artifacts included;
- no private storage keys in manifest;
- package contains expected relative paths.

### 9.3 E2E tests

Add a focused E2E only if stable and not too heavy:

```text
create or use crop workflow fixture
generate crop export
verify export link/manifest available
```

Do not make browser E2E assert every manifest field; unit/integration tests should cover exact manifest contract.

---

## 10. Documentation Updates

Update:

```text
docs/06-data/training-export-contract.md
docs/06-data/crop-based-slice-annotation.md
docs/06-data/coordinate-spaces-and-transforms.md
docs/06-data/mask-and-artifact-versioning.md
docs/03-features/projects.md
docs/03-features/editor.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- crop export package layout;
- crop/original coordinate transform;
- crop masks are crop-coordinate masks;
- optional original-coordinate reprojection status;
- readiness reasons;
- prediction-analysis export remains separate;
- RB-092 will finalize review/readiness UI and policy integration.

---

## 11. Acceptance Criteria

1. `git status --short` is clean.
2. Crop export manifest contract exists.
3. Crop export manifest includes original/crop coordinate provenance.
4. Support, semantic and classification versions are traceable.
5. Lineage validation detects mismatches.
6. Readiness reasons are emitted for missing/not-approved/inconsistent items.
7. Existing full-image export still works.
8. Prediction-analysis export semantics are unchanged.
9. No private storage keys leak.
10. Tests cover transform metadata and manifest/package structure.
11. Docs are updated.
12. Ticket is moved to the crop sprint done folder.
13. Full validation gate passes:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

14. Final Codex report includes:
    - commits created,
    - export target/manifest changes,
    - package layout,
    - readiness/lineage rules,
    - tests added/changed,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 12. Suggested Commit Sequence

```bash
git commit -m "docs: define crop export contract"
git commit -m "feat: add crop export manifest resolver"
git commit -m "feat: add crop export package generation"
git commit -m "test: cover crop export lineage"
git commit -m "docs: document crop export package"
git commit -m "chore: finalize crop export ticket"
```

---

## 13. Notes for Codex

- Do not implement final review/readiness UI; that is RB-092.
- Do not change prediction-analysis export semantics.
- Do not export predictions as ground truth.
- Crop masks are derived artifacts tied to original image lineage.
- Prefer explicit `NOT_READY` reasons over weakening review requirements.
