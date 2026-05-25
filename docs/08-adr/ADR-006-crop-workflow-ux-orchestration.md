# ADR-006 - Crop Workflow UX Orchestration

## Status

Accepted for RB-093 design. RB-094 implements the image-level BBox stage and confirmation state. RB-095 implements the whole-image slice navigator. RB-096 implemented the earlier selected crop workbench. RB-123 removes the workbench screen, unifies crop support/semantic editing under the selected-crop editor route, and implements byte-derived annotation-family exclusivity. RB-103 implements BBox-stage re-entry from crop editors. RB-104 removes the legacy full-image editor route and surface. RB-098 owns remaining smoke/closeout coverage.

## Context

RB-086 through RB-092 added the technical crop primitives: source-image BBox proposals, derived crops, crop support masks, crop-constrained semantic masks, auto-derived slice classifications, crop training export, and shared crop readiness.

Manual smoke testing showed that exposing those primitives beside the old full-image editor made the workflow confusing. The data model is sound, and the user-facing workflow is now the staged crop route model.

## Decision

Adopt a route-addressable crop workflow with explicit user stages:

```text
BBox stage
-> slice navigator
-> selected-crop unified editor
-> annotation family target
-> classification/readiness
```

BBoxes are confirmed as a workflow planning step. They are not approved ground truth and must not reuse review/approval wording. Ground-truth review remains artifact-specific for support masks, semantic masks, and slice classifications.

The guided crop workflow should use these planned browser routes:

- `/app/projects/[projectId]/images/[imageId]/crop` - crop workflow entry/controller route.
- `/app/projects/[projectId]/images/[imageId]/crop/bboxes` - image-level BBox stage.
- `/app/projects/[projectId]/images/[imageId]/crop/slices` - whole-image slice navigator and status view.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]` - compatibility selected-slice route.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]` - selected-crop unified editor route.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/support` - compatibility alias that opens the unified editor with the Support label selected.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic` - compatibility alias for the semantic target.

The existing crop editor routes remain valid deep links and compatibility routes until the guided workflow replaces or redirects them:

- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support`
- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic`

The old full-image editor route is removed as a product surface:

- `/app/projects/[projectId]/images/[imageId]/edit`

RB-103 replaces crop workflow links to the old editor with explicit BBox-stage re-entry from crop support and semantic editors. RB-104 supersedes the original compatibility assumption; old editor links now use normal workspace not-found behavior.

The planned crop entry route should resolve state from persisted backend data rather than a client-only state machine. RB-094 should add lightweight persisted BBox set state because the current append-only BBox rows can prove that active BBoxes exist, but they cannot prove that a user intentionally confirmed the complete image-level set.

## Workflow States

Image-level BBox set state:

- `NO_BBOXES` - no active BBox proposals exist for the image.
- `BBOX_DRAFT` - at least one active BBox exists, but the image-level set is not confirmed.
- `BBOX_CONFIRMED` - an authenticated user confirmed the current BBox set as the crop work plan.
- `BBOX_NEEDS_UPDATE` - a confirmed set was later edited, deleted, or made stale relative to current active BBox versions.

Per-slice/crop state:

- BBox: missing, draft, confirmed, or needs update through the image-level set state plus active BBox membership.
- Crop: `CROP_MISSING`, `CROP_CURRENT`, or `CROP_STALE`.
- Support mask: missing or the current artifact review state (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `SUPERSEDED`).
- Semantic mask: missing or the current artifact review state, with semantic family recorded as `SAP_HEARTWOOD`, `COPPER`, `UNSET`, or `CONFLICT`.
- Classification: missing, auto-derived, manual override, review-required, and the current classification review state.
- Overall readiness: continue using `READY`, `PARTIAL`, `NOT_READY`, and `REVIEW_REQUIRED` from `src/server/domain/cropReadiness.ts`.

## Consequences

- RB-094 owns persisted BBox confirmation and transition UI. Implemented through `ImageCropWorkflowState`, `/crop/bboxes`, and `/api/images/[imageId]/slice-bboxes/confirm`.
- RB-095 owns the whole-image slice navigator and per-slice status badges. It is implemented through `/crop/slices/[sliceInstanceId]`, `src/features/editor/ImageCropSliceNavigatorClient.tsx`, and `src/server/domain/cropSliceNavigator.ts`.
- RB-096 owned the earlier selected crop workbench. RB-123 supersedes it with the unified crop annotation editor at the selected-crop route.
- RB-123 owns annotation-family exclusivity and classification guardrails. It is implemented through byte-derived family detection, `CROP_ANNOTATION_FAMILY_CONFLICT` server guards, all-background clearing saves, and readiness blockers for contradictory manual classifications or legacy conflicts.
- RB-103 owns explicit re-entry from crop editors to the BBox stage, including confirmed-set edit/re-prepare smoke coverage. Crop editor headers and the embedded navigator rail expose `Edit BBoxes`; opening the BBox stage after confirmation shows locked proposals until the user explicitly unlocks editing.
- RB-104 removes the legacy full-image editor route and full-image annotation surface while preserving BBox-stage and assisted-correction functionality through non-legacy surfaces.
- RB-098 owns smoke coverage and final workflow closeout after RB-103/RB-104.
- Crop-based annotation is the primary staged workflow for multi-slice crop work. Full-image mask editing has been removed from the product UI.

## Evidence

- Current sprint overview: `tickets/crop-workflow-ux-orchestration-sprint/SPRINT-crop-workflow-ux-orchestration.md`
- Current RB-093 ticket: `tickets/crop-workflow-ux-orchestration-sprint/done/RB-093-crop-workflow-ux-state-machine-route-design.md`
- Crop workflow design: `docs/06-data/crop-based-slice-annotation.md`
- Current crop readiness resolver: `src/server/domain/cropReadiness.ts`
- Removed full-image editor route: `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx`
- Current crop support compatibility route: `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support/page.tsx`
- Current crop semantic compatibility route: `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic/page.tsx`
- Current unified crop editor route: `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/page.tsx`
- Current crop editor BBox re-entry rail: `src/features/editor/CropEditorSliceNavigatorRailClient.tsx`
- Current browser re-entry coverage: `tests/e2e/slice-bbox-proposals.spec.ts`
