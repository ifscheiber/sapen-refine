# RB-087 — Derived Slice Crop Generation

## Status

Done / Implemented

## Priority

High

## Type

Derived Artifacts / Crop Generation / Storage / Coordinates / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-085 — Crop-Based Slice Annotation Workflow ADR / Design
- RB-086 — BBox Slice Proposal Workflow

## Blocks

- RB-088 — Crop Support Mask Editor
- RB-089 — Crop-Constrained Semantic Annotation
- RB-090 — Auto Slice Classification from Semantic Masks
- RB-091 — Crop / Original Coordinate Export Contract
- RB-092 — Crop Workflow Review / Approval Integration

---

## 1. Context

RB-086 implemented the BBox slice proposal workflow:

- append-only `SliceBoundingBoxVersion` persistence,
- `SOURCE_IMAGE_PIXEL` geometry,
- BBox APIs,
- editor BBox proposal mode,
- draw/select/replace/delete/persist/reload behavior,
- unit, integration and Playwright coverage,
- always append-only BBox versioning,
- deleting creates a `DELETED` version and clears the current `SliceInstance.boundingBox` summary.

RB-087 is the next step in the crop-based annotation sprint.

The existing RB-087 draft correctly states the purpose: generate derived slice crops from saved BBox proposals, treat crops as derived artifacts rather than raw uploaded images, keep crops traceable to the original image, clamp padding to source-image bounds, store coordinate transforms, expose app-mediated crop read routes, and document regeneration behavior. fileciteturn28file0

This optimized RB-087 keeps the scope narrow:

```text
BBox version → derived crop artifact/version → app-mediated crop preview/read
```

It must not implement the crop support mask editor yet.

---

## 2. Goal

Generate and persist derived slice crops from active BBox proposal versions.

At the end of RB-087:

1. An authorized user can generate a crop from a current/active BBox version.
2. The crop is stored as a derived artifact, not as a raw uploaded image.
3. The crop records lineage to:
   - source image,
   - source image checksum,
   - slice instance,
   - BBox version,
   - creating user.
4. The crop records source-image bounds, requested padding, clipped padding and integer coordinate transform.
5. The crop is privately stored and accessible through an app-mediated read/preview route.
6. If a BBox changes, a new crop version can be generated and old crop versions remain historical.
7. Existing image/editor/BBox workflows remain green.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- pixel-perfect crop support mask drawing,
- crop semantic annotation,
- support-first readiness UI beyond crop availability status,
- auto classification,
- crop-aware export implementation,
- review/approval workflow changes,
- prediction import/correction changes,
- model inference,
- crop batch generation,
- client-side image processing as source of truth,
- treating derived crops as raw uploaded images.

If needed, document for RB-088+.

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

Because RB-087 likely introduces schema, storage and route changes, run `db:rebuild`, `prisma:generate`, `typecheck`, `test` and `test:e2e` before finalizing.

---

## 5. Domain / Schema Scope

### 5.1 Derived crop model

Add a persistent derived crop model, or use an equivalent artifact/version model if already designed.

Preferred concept name:

```text
DerivedSliceCrop
```

Required concepts:

```text
id
projectId
sourceImageId
sourceImageChecksum
sliceInstanceId
bboxVersionId
version
status if needed
cropX
cropY
cropWidth
cropHeight
paddingRequestedPx
paddingAppliedLeftPx
paddingAppliedTopPx
paddingAppliedRightPx
paddingAppliedBottomPx
sourceX
sourceY
sourceWidth
sourceHeight
coordinateSpace = CROP_PIXEL
transformToSourceJson
storageKey
checksum
contentType
byteSize
createdById
createdAt
metadataJson optional
```

Naming may differ, but semantics must be preserved.

### 5.2 Coordinate model

Use integer pixel coordinates.

Definitions:

```text
bboxX/Y/W/H:
  BBox version in SOURCE_IMAGE_PIXEL coordinates.

paddingRequestedPx:
  user/system requested padding around BBox.

sourceX/sourceY/sourceWidth/sourceHeight:
  final crop rectangle in SOURCE_IMAGE_PIXEL coordinates after padding and clipping.

cropX/cropY:
  should usually be 0/0 in CROP_PIXEL coordinates.

cropWidth/cropHeight:
  final crop dimensions.

transform:
  sourceX = cropPixelX + sourceX
  sourceY = cropPixelY + sourceY
```

If a different naming convention is chosen, document it clearly.

### 5.3 Padding and clipping

First implementation must clamp crops to image bounds.

Example:

```text
requested crop = bbox + padding
if requested crop crosses image boundary:
  clamp to source image
  record which padding sides were clipped
```

The crop manifest/metadata must indicate whether requested padding was clipped.

### 5.4 Versioning behavior

Crops are append-only derived artifacts.

Rules:

- generate crop from a specific `SliceBoundingBoxVersion`;
- if BBox changes later, generate a new crop version;
- old crops remain historical;
- downstream masks in RB-088+ will reference a specific crop version;
- deleting a BBox does not delete historical crops automatically.

### 5.5 Current crop pointer

If useful, `SliceInstance` may store a current/active crop reference.

If adding such a field is too broad, provide a service/helper that resolves the latest active crop for a slice instance.

Document the chosen rule.

---

## 6. Crop Generation Service

### 6.1 Server-side generation

Add a server-side service:

```text
generateCropForSliceBBox(...)
```

or equivalent.

Requirements:

- loads BBox version,
- verifies BBox belongs to image/project,
- verifies BBox is active/not deleted,
- reads source image server-side,
- extracts crop with padding/clamping,
- encodes/stores crop privately,
- computes checksum, dimensions, content type and byte size,
- persists derived crop record,
- returns sanitized metadata only.

### 6.2 Image decoding/cropping implementation

Use an existing safe image processing dependency if already present.

If no image crop library exists:

- choose a minimal dependency only if necessary and justified,
- or use existing platform utilities if already in repo,
- or implement only the crop metadata/service skeleton and document image byte generation as deferred if truly blocked.

Preferred: actual crop image bytes are generated in RB-087, because RB-088 needs a crop editor.

### 6.3 Supported source image types

Use source image types already supported by upload validation.

Do not expand supported image types unless necessary.

If unsupported image type encountered, return stable error:

```text
CROP_SOURCE_IMAGE_UNSUPPORTED
```

### 6.4 Storage

Store crops under a private derived-artifact prefix, for example:

```text
projects/{projectId}/images/{imageId}/slices/{sliceInstanceId}/crops/{cropId}.png
```

or follow existing storage key conventions.

No private storage key in browser response.

### 6.5 Content type

Preferred crop output format:

```text
image/png
```

unless the repo has a documented derived-image format.

PNG is acceptable for deterministic crop previews and editor input.

---

## 7. API / Server Scope

Add app-mediated APIs.

Suggested routes:

```text
GET  /api/images/[imageId]/slice-crops
POST /api/slice-bboxes/[bboxVersionId]/crop
GET  /api/slice-crops/[cropId]
GET  /api/slice-crops/[cropId]/asset
```

Exact route names may follow repo conventions.

Requirements:

- authenticated user,
- project access via current policy layer,
- owner/QA/labeler or annotate-capable role can generate crops,
- viewer may read crop metadata/asset if policy allows project read,
- stable JSON errors via RB-072 helpers,
- no private storage keys.

### 7.1 POST crop generation response

Return sanitized metadata:

```json
{
  "ok": true,
  "crop": {
    "id": "...",
    "sourceImageId": "...",
    "sliceInstanceId": "...",
    "bboxVersionId": "...",
    "sourceX": 10,
    "sourceY": 20,
    "cropWidth": 1200,
    "cropHeight": 900,
    "coordinateSpace": "CROP_PIXEL",
    "checksum": "sha256:...",
    "contentType": "image/png",
    "assetUrl": "/api/slice-crops/.../asset"
  }
}
```

No storage key.

---

## 8. UI Scope

RB-087 should add minimal UI affordance to generate/view crops, but not a crop editor.

From BBox proposal list or editor BBox panel:

- show whether crop exists for current BBox version;
- button: `Generate crop`;
- show crop thumbnail/preview when available;
- link placeholder for future crop support editor, disabled or labeled “Support editor coming next” if needed.

Do not implement support mask drawing in this ticket.

---

## 9. Tests

### 9.1 Unit tests

Add tests for:

- crop rectangle calculation,
- padding expansion,
- clipping at image bounds,
- transform mapping crop pixel to source pixel,
- invalid BBox rejection,
- deleted/stale BBox behavior.

### 9.2 Integration / API tests

Cover:

- authorized user generates crop,
- viewer cannot generate crop,
- generated crop references source image, BBox version and slice instance,
- crop dimensions/checksum/content type recorded,
- crop asset route streams image bytes without storage key leak,
- padding clipped at bounds is recorded,
- BBox changed later results in new crop version,
- deleted BBox cannot generate new crop,
- stable JSON errors for missing/forbidden cases.

### 9.3 E2E tests

Add a focused E2E if stable:

```text
login
open image with BBox proposal
generate crop
see crop preview/metadata
reload
crop still listed
```

Do not add crop support drawing.

Existing E2E must remain green.

---

## 10. Documentation Updates

Update:

```text
docs/06-data/crop-based-slice-annotation.md
docs/06-data/coordinate-spaces-and-transforms.md
docs/06-data/mask-and-artifact-versioning.md
docs/03-features/editor.md
docs/03-features/images.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- crop is derived artifact, not raw image;
- crop references source image and BBox version;
- crop coordinates are clipped integer source-image pixels;
- crop coordinate space is `CROP_PIXEL`;
- transform to source image is explicit;
- crop editor/support annotation comes in RB-088;
- old crop versions remain historical.

---

## 11. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean.
2. Crop can be generated from an active BBox version.
3. Crop is stored as derived artifact, not raw uploaded image.
4. Crop stores source image, slice instance and BBox version lineage.
5. Crop stores crop rectangle, padding/clipping and transform metadata.
6. Crop asset is accessible through app-mediated route without storage key leak.
7. BBox changes create new crop versions rather than mutating old crops.
8. Deleted/stale BBox behavior is safe and tested.
9. Minimal UI shows/generates crop but does not implement crop support editing.
10. Tests cover crop geometry, API, storage and transform behavior.
11. Existing editor/BBox workflows remain green.
12. Docs are updated.
13. Ticket is moved to:

```text
tickets/2026-05-22/done/
```

or the current crop sprint done folder if that is the active convention.

14. Final validation passes:

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

15. Final Codex report includes:
    - commits created,
    - schema/migration changes,
    - crop storage format,
    - routes/services/components changed,
    - transform model,
    - tests added/changed,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 12. Suggested Commit Sequence

```bash
git commit -m "docs: define derived slice crop generation"
git commit -m "schema: add derived slice crop persistence"
git commit -m "feat: add slice crop generation service"
git commit -m "feat: add slice crop api and preview"
git commit -m "test: cover derived slice crop geometry"
git commit -m "docs: document derived crop workflow"
git commit -m "chore: finalize derived slice crop ticket"
```

---

## 13. Notes for Codex

- Crop is a derived artifact, not a raw uploaded image.
- Do not implement support mask drawing in this ticket.
- Keep transforms integer and explicit.
- Do not leak private storage keys.
- Preserve existing BBox and editor workflows.
