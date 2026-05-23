# RB-089 — Crop-Constrained Semantic Annotation

## Status

Done

## Priority

High

## Type

Editor / Semantic Annotation / Crop Workflow / Copper / Sapwood-Heartwood / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-085 — Crop-Based Slice Annotation Workflow ADR / Design
- RB-086 — BBox Slice Proposal Workflow
- RB-087 — Derived Slice Crop Generation
- RB-088 — Crop Editor: Mandatory Pixel-Perfect Slice Support Mask

## Blocks

- RB-090 — Auto Slice Classification from Semantic Masks
- RB-091 — Crop / Original Coordinate Export Contract
- RB-092 — Crop Workflow Review / Approval Integration

---

## 1. Context

RB-088 implemented the crop support-mask editor:

- support masks are persisted as `SLICE_SUPPORT_MASK`,
- they are linked to `DerivedSliceCrop` and `SliceInstance`,
- they use `CROP_PIXEL`,
- the crop support editor is deep-linkable,
- support masks are the authoritative instance geometry.

The original RB-089 draft correctly defines the next step: semantic annotation should happen inside a slice crop constrained by the support mask; outside-support editing should be locked/ignored; Sap/Heartwood may support complement fill; Copper requires support; Copper masks are never support geometry. It also correctly excludes BBox creation, crop generation, support editor, auto-classification, export changes and inference from this ticket.

RB-089 should implement semantic crop annotation only. It must not implement auto-classification or crop-aware export.

---

## 2. Goal

Enable semantic annotation inside a derived slice crop while constraining all semantic edits to the selected support mask.

At the end of RB-089:

1. A user can open a semantic crop editor for a derived crop with an existing support mask.
2. Semantic editing is constrained to the support mask.
3. Outside-support pixels are locked/ignored/rejected and cannot become semantic labels.
4. Semantic masks are saved as versioned `SEMANTIC_MASK` artifacts in `CROP_PIXEL`.
5. Semantic masks link to:
   - project,
   - source image,
   - slice instance,
   - derived crop,
   - exact support mask version used as constraint,
   - actor.
6. Sap/Heartwood mode exists.
7. Copper mode exists and requires support.
8. Copper semantic masks never mutate or replace support masks.
9. Existing BBox, crop, support, full-image editor, review and export workflows remain green.

---

## 3. Non-Goals

Do **not** implement:

- BBox creation changes,
- crop generation changes,
- support editor changes beyond navigation/readiness links,
- auto slice classification,
- crop-aware export,
- review/approval redesign,
- model inference,
- prediction import/correction changes,
- multi-object crop editor,
- support mask generation from semantic masks.

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

### 5.1 Semantic mask artifact

Persist crop semantic masks using existing annotation artifact/version concepts if possible.

Required semantics:

```text
artifact kind: SEMANTIC_MASK
coordinateSpace: CROP_PIXEL
derivedCropId: DerivedSliceCrop.id
sliceInstanceId: SliceInstance.id
sourceImageId: ImageAsset.id
supportMaskVersionId: AnnotationArtifactVersion.id
format: u8raw-v1
reviewState: DRAFT initially
```

The semantic version must reference the exact support-mask version used as the editing constraint.

### 5.2 Required metadata

Each semantic mask version must record or reference:

```text
projectId
sourceImageId
sliceInstanceId
derivedCropId
supportMaskVersionId
crop width / height
coordinateSpace = CROP_PIXEL
crop transform reference
semanticMode = SAP_HEARTWOOD | COPPER
label schema version
storage key
checksum
byteSize
format / content type
createdById
createdAt
reviewState
```

No private storage key may appear in browser responses.

### 5.3 Support lineage rule

Semantic crop annotation requires a current non-deleted support mask version for the same crop and slice.

Server must validate:

```text
semantic.derivedCropId === support.derivedCropId
semantic.sliceInstanceId === support.sliceInstanceId
semantic.width === support.width
semantic.height === support.height
semantic.coordinateSpace === CROP_PIXEL
```

Use stable errors such as:

```text
SUPPORT_MASK_REQUIRED
SUPPORT_MASK_LINEAGE_MISMATCH
```

or equivalent.

---

## 6. Semantic Modes

### 6.1 Sap/Heartwood mode

Inside support:

```text
Sapwood / Heartwood / optionally Unknown
```

Outside support:

```text
background / locked / not editable
```

Complement fill is desirable but must be explicit.

Allowed RB-089 outcomes:

- implement explicit complement fill; or
- document complement fill as deferred and allow painting both labels manually.

Do not silently auto-fill the other class without clear user action.

### 6.2 Copper mode

Copper mode is constrained to support pixels.

Rules:

```text
inside support:
  Copper/penetrated pixels may be painted.
  non-copper wood is implicit negative, explicit label, or unknown according to documented contract.

outside support:
  Copper pixels must be ignored/rejected/cleared.
```

Copper semantic masks are never support masks and must never expand support geometry.

---

## 7. Server-Side Support Constraint

Client UI must prevent drawing outside support, but server must enforce it too.

On semantic save:

1. load support mask bytes for `supportMaskVersionId`;
2. validate dimensions and coordinate space;
3. validate semantic mask dimensions and byte length;
4. validate semantic label values;
5. enforce outside-support rule.

Codex must choose and document one behavior:

### Option A — reject

If any outside-support semantic pixels exist:

```text
SEMANTIC_OUTSIDE_SUPPORT
```

Preferred for strict data integrity.

### Option B — sanitize

Clear outside-support pixels before persistence and record safe audit diagnostics.

Preferred only if the editor save path makes this safer and tests are explicit.

---

## 8. API / Server Scope

Add app-mediated APIs.

Suggested routes:

```text
GET  /api/slice-crops/[cropId]/semantic-mask
POST /api/slice-crops/[cropId]/semantic-mask/upload
```

Request must include or imply:

```text
supportMaskVersionId
semanticMode = SAP_HEARTWOOD | COPPER
```

Requirements:

- authenticated user,
- project access via current policy layer,
- annotate-capable roles can save,
- viewer cannot mutate,
- stable JSON errors via API error helpers,
- same-origin guard compatibility,
- no private storage keys.

Use raw mask upload contract:

```text
content-type: application/octet-stream
x-mask-format: u8raw-v1
x-mask-width: cropWidth
x-mask-height: cropHeight
x-mask-byte-length: cropWidth * cropHeight
```

Server source of truth remains actual received bytes.

---

## 9. Editor / UI Scope

### 9.1 Semantic crop editor route

Add a route such as:

```text
/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic
```

or align with existing routes.

The route must be deep-linkable and use safe missing-resource handling.

### 9.2 Preconditions

If no support mask exists, show a soft blocking state:

```text
Support mask required before semantic annotation.
Open support editor.
```

If support exists but is draft/submitted/not approved, RB-089 may still allow local semantic draft editing but must show the support state clearly. Export readiness is RB-092.

### 9.3 Editor behavior

Reuse existing editor helpers/components where practical:

- crop canvas,
- brush,
- eraser,
- dirty/save state,
- raw mask upload helper,
- pointer/touch handling.

User can:

- view crop image,
- see support boundary/overlay,
- choose Sap/Heartwood or Copper mode,
- draw semantic labels only inside support,
- erase semantic labels,
- save,
- reload persisted semantic mask,
- see support/semantic readiness state.

### 9.4 Label palettes

Sap/Heartwood mode shows only relevant semantic labels:

```text
Sapwood
Heartwood
Unknown if supported
Background/erase
```

Copper mode shows only relevant labels:

```text
Copper / penetrated
Non-copper / negative if explicit
Unknown if supported
Background/erase
```

Do not show support-mask labels in semantic editor.

---

## 10. Tests

### Unit tests

- support-constrained semantic validation,
- outside-support reject/sanitize behavior,
- support/semantic lineage matching,
- semantic mode label validation,
- complement fill helper if implemented,
- Copper support-minus-copper helper if implemented.

### Integration / API tests

- saving semantic mask requires support;
- authorized user saves Sap/Heartwood semantic mask;
- authorized user saves Copper semantic mask;
- viewer cannot save;
- missing crop/support returns stable JSON error;
- wrong support/crop lineage rejected;
- wrong dimensions rejected;
- outside-support semantic pixels rejected/sanitized;
- Copper semantic mask is `SEMANTIC_MASK`, not `SLICE_SUPPORT_MASK`;
- support mask is not mutated by semantic save;
- no storage key in response.

### E2E

Add focused E2E if stable:

```text
login
open or create BBox/crop/support fixture
open crop semantic editor
verify support overlay
paint semantic label inside support
save
reload
semantic mask remains available
```

Avoid brittle browser pixel assertions if API/unit tests cover exact mask values.

---

## 11. Documentation Updates

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

- semantic crop annotation requires support mask;
- semantic edits are constrained to support;
- semantic masks use `CROP_PIXEL`;
- semantic masks reference exact support version;
- Copper semantic masks are not support geometry;
- outside-support behavior is reject/sanitize according to implementation;
- auto classification comes in RB-090;
- export/readiness integration comes later.

---

## 12. Acceptance Criteria

1. `git status --short` is clean.
2. User can open semantic crop editor when support exists.
3. Missing support shows soft blocking state and support-editor link.
4. User can save/reload semantic crop mask.
5. Semantic crop mask is saved as `SEMANTIC_MASK` with `CROP_PIXEL`.
6. Semantic mask references `DerivedSliceCrop`, `SliceInstance`, source image and exact support mask version.
7. Server enforces support constraint.
8. Outside-support semantic pixels are handled according to documented rule.
9. Sap/Heartwood mode is available, with complement fill implemented or explicitly deferred.
10. Copper mode is available and requires support.
11. Copper semantic mask never mutates or replaces support mask.
12. Invalid dimensions/values/lineage are rejected.
13. No private storage key leaks.
14. Existing BBox/crop/support/full-image workflows remain green.
15. Docs are updated.
16. Ticket is moved to the crop sprint done folder.
17. Full validation gate passes.

---

## 13. Suggested Commit Sequence

```bash
git commit -m "docs: define crop semantic annotation scope"
git commit -m "feat: add crop semantic mask api"
git commit -m "feat: add support constrained semantic editor"
git commit -m "test: cover crop semantic mask constraints"
git commit -m "docs: document crop semantic annotation workflow"
git commit -m "chore: finalize crop semantic annotation ticket"
```

---

## 14. Notes for Codex

- Do not implement auto classification here.
- Do not implement export integration here.
- Support mask is authoritative geometry.
- Semantic mask is constrained by support and references the exact support version.
- Copper semantic mask is not support geometry.
