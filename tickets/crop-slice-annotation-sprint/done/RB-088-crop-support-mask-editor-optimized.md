# RB-088 — Crop Editor: Mandatory Pixel-Perfect Slice Support Mask

## Status

Done / Implemented

## Priority

High

## Type

Editor / Crop Annotation / Support Mask / Instance Geometry / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-085 — Crop-Based Slice Annotation Workflow ADR / Design
- RB-086 — BBox Slice Proposal Workflow
- RB-087 — Derived Slice Crop Generation

## Blocks

- RB-089 — Crop-Constrained Semantic Annotation
- RB-090 — Auto Slice Classification from Semantic Masks
- RB-091 — Crop / Original Coordinate Export Contract
- RB-092 — Crop Workflow Review / Approval Integration

---

## 1. Context

RB-087 added derived crop generation from active BBox versions, including `DerivedSliceCrop` persistence, `CROP_PIXEL`, server-side PNG crop generation with `sharp`, configurable 32px default padding, app-mediated crop asset streaming, transform metadata, crop preview UI, and tests.

The existing RB-088 draft correctly states the next step: users must draw the pixel-perfect complete slice support mask inside the derived crop, and this support mask becomes the authoritative instance geometry for the slice. It also correctly states that Copper semantic annotation requires support first, and that semantic crop annotation, auto-classification and export changes are non-goals. fileciteturn29file0

RB-088 must therefore implement the **crop support mask editor only**.

---

## 2. Goal

Allow users to create, edit, save and reload the pixel-perfect complete slice support mask inside a derived crop.

At the end of RB-088:

1. User can open a crop support editor for a derived slice crop.
2. Crop image is displayed in crop coordinate space.
3. User can draw and erase a binary support mask representing the complete physical wood-piece outline.
4. Support mask is saved as a versioned `SLICE_SUPPORT_MASK` artifact.
5. Support mask is linked to project, source image, slice instance and derived crop.
6. Support mask uses `CROP_PIXEL` coordinate space and crop dimensions.
7. Support mask can be mapped back to original image coordinates through the crop transform.
8. Semantic crop annotation remains locked/deferred until support exists.
9. Existing full-image editor, BBox and crop preview workflows remain green.

---

## 3. Non-Goals

Do **not** implement in this ticket:

- Sapwood/Heartwood semantic crop annotation,
- Copper semantic crop annotation,
- auto slice classification,
- crop-aware export implementation,
- review/approval redesign,
- multi-object crop editor,
- advanced polygon tools,
- model inference,
- derived crop generation changes,
- original full-image support-mask behavior changes.

---

## 4. Required Baseline

Run before editing:

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

---

## 5. Domain / Persistence Scope

### 5.1 Support mask artifact

Persist crop support masks using existing annotation artifact/version concepts if possible.

Required semantics:

```text
artifact kind: SLICE_SUPPORT_MASK
coordinateSpace: CROP_PIXEL
derivedCropId: DerivedSliceCrop.id
sliceInstanceId: SliceInstance.id
sourceImageId: ImageAsset.id
format: u8raw-v1
reviewState: DRAFT initially
```

If existing `AnnotationArtifact` / `AnnotationArtifactVersion` supports this, reuse it. Avoid a parallel mask persistence model unless necessary.

### 5.2 Required metadata

Each support mask version must record or reference:

```text
projectId
sourceImageId
sliceInstanceId
derivedCropId
crop width / height
coordinateSpace = CROP_PIXEL
crop transform reference
storage key
checksum
byteSize
contentType / format
createdById
createdAt
reviewState
```

Do not duplicate transform JSON if referencing `DerivedSliceCrop` is sufficient, but reprojection to original image coordinates must be unambiguous.

### 5.3 Binary values

Support mask is binary/support-compatible:

```text
0 = background / outside support
1 or configured support value = inside physical wood piece
```

Use current support-mask value conventions. Reject invalid values.

### 5.4 Versioning

Saving creates a new support mask version.

Rules:

- do not mutate approved/historical versions,
- latest draft/current support version is shown in editor,
- downstream semantic annotation will reference a specific support mask version.

---

## 6. API / Server Scope

Add app-mediated APIs for crop support masks.

Suggested routes, adapt to repo conventions:

```text
GET  /api/slice-crops/[cropId]/support-mask
POST /api/slice-crops/[cropId]/support-mask/upload
```

Requirements:

- authenticated user,
- project access via current policy layer,
- annotate-capable roles can save,
- viewer cannot mutate,
- stable JSON errors via API error helpers,
- same-origin guard compatibility,
- no private storage keys in responses.

### 6.1 Upload contract

Use current raw mask contract:

```text
content-type: application/octet-stream
x-mask-format: u8raw-v1
x-mask-width: cropWidth
x-mask-height: cropHeight
x-mask-byte-length: cropWidth * cropHeight
```

Server source of truth remains actual received bytes. Reuse RB-080/RB-081 raw mask validation helpers.

### 6.2 Crop validation

Server validates:

- crop exists,
- crop belongs to project/source image/slice instance,
- submitted mask dimensions match crop dimensions,
- coordinate space is `CROP_PIXEL`,
- support values are valid,
- actor has permission.

---

## 7. Editor / UI Scope

### 7.1 Crop support editor route

Add a route such as:

```text
/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support
```

or align with current routing.

The route must be deep-linkable and use safe missing-resource behavior.

### 7.2 Editor behavior

Reuse existing editor components/helpers where practical:

- canvas,
- brush,
- eraser,
- dirty/save state,
- raw mask upload helper,
- pointer/touch handling.

User can:

- view crop image,
- draw support mask,
- erase support mask,
- save,
- reload persisted support mask,
- see support readiness state.

### 7.3 UI copy

Only support/background labels should be available.

Do not show Sapwood/Heartwood/Copper semantic labels here.

UI copy should clearly state:

```text
Draw the complete outline of the physical wood slice.
This support mask is required before semantic crop annotation.
Copper penetration masks are not support masks.
```

---

## 8. Transform Helper

Add pure helper(s) for crop pixel to source image pixel mapping:

```text
sourceX = cropPixelX + crop.sourceX
sourceY = cropPixelY + crop.sourceY
```

If full mask reprojection is too broad, implement/test coordinate helpers now and leave full reprojected export for RB-091.

---

## 9. Tests

### Unit tests

- crop pixel → source pixel transform,
- support mask value validation,
- support mask dimension validation,
- support readiness summary helper if present.

### Integration/API tests

- authorized user saves crop support mask,
- viewer cannot save,
- missing crop returns stable JSON error,
- wrong dimensions rejected,
- invalid support values rejected,
- saved mask is `SLICE_SUPPORT_MASK`,
- saved mask is `CROP_PIXEL`,
- saved mask links crop and slice instance,
- no storage key in response,
- reload returns latest support mask metadata.

### E2E

Add focused E2E if stable:

```text
login
open image
create/use BBox and crop fixture
open crop support editor
draw support mask
erase small part if practical
save
reload
support mask remains available
```

Exact pixel assertions should stay in unit/API tests if browser-level pixel checks are brittle.

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

- crop support mask is the pixel-perfect physical slice geometry,
- support mask is mandatory before semantic crop annotation,
- Copper semantic masks are not support masks,
- support mask uses `CROP_PIXEL`,
- support mask references `DerivedSliceCrop`,
- support mask can be mapped to original image coordinates,
- crop semantic editor comes in RB-089.

---

## 11. Acceptance Criteria

1. `git status --short` is clean.
2. User can open crop support editor for a derived crop.
3. User can draw and erase support mask in crop coordinates.
4. Support mask saves and reloads.
5. Support mask is versioned, attributable and linked to crop/slice/source image.
6. Support mask uses `SLICE_SUPPORT_MASK` and `CROP_PIXEL`.
7. Support mask dimensions match crop dimensions.
8. Invalid support values/dimensions are rejected.
9. Support readiness state is visible or available.
10. Semantic crop annotation remains locked/deferred until support exists.
11. Crop/source coordinate transform helper is tested.
12. No private storage key leaks.
13. Existing full-image editor, BBox and crop preview workflows remain green.
14. Docs are updated.
15. Ticket is moved to the crop sprint done folder.
16. Full validation gate passes.

---

## 12. Suggested Commit Sequence

```bash
git commit -m "docs: define crop support mask editor scope"
git commit -m "feat: add crop support mask api"
git commit -m "feat: add crop support editor"
git commit -m "test: cover crop support mask workflow"
git commit -m "docs: document crop support mask workflow"
git commit -m "chore: finalize crop support mask ticket"
```

---

## 13. Notes for Codex

- Support mask is the authoritative instance geometry.
- Do not implement semantic crop annotation.
- Copper semantic mask is not support geometry.
- Use crop coordinate space and preserve source transform.
- Reuse existing editor and upload helpers where possible.
