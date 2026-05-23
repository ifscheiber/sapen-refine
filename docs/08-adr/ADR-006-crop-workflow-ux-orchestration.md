# ADR-006 - Crop Workflow UX Orchestration

## Status

Accepted for RB-093 design. RB-094 implements the image-level BBox stage and confirmation state. RB-095 implements the whole-image slice navigator. RB-096 through RB-098 implement the remaining runtime workflow slices.

## Context

RB-086 through RB-092 added the technical crop primitives: source-image BBox proposals, derived crops, crop support masks, crop-constrained semantic masks, auto-derived slice classifications, crop training export, and shared crop readiness.

Manual smoke testing showed that those primitives are currently exposed together in the full-image editor. Users can still see full-image semantic/support/classification controls beside BBox and crop workflow controls. The data model is sound, but the user-facing workflow needs a staged route and state model before the next UI tickets.

## Decision

Adopt a route-addressable crop workflow with explicit user stages:

```text
BBox stage
-> slice navigator
-> selected-slice crop workbench
-> support mask
-> semantic mask
-> classification/readiness
```

BBoxes are confirmed as a workflow planning step. They are not approved ground truth and must not reuse review/approval wording. Ground-truth review remains artifact-specific for support masks, semantic masks, and slice classifications.

The guided crop workflow should use these planned browser routes:

- `/app/projects/[projectId]/images/[imageId]/crop` - crop workflow entry/controller route.
- `/app/projects/[projectId]/images/[imageId]/crop/bboxes` - image-level BBox stage.
- `/app/projects/[projectId]/images/[imageId]/crop/slices` - whole-image slice navigator and status view.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]` - selected-slice workbench.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]` - selected crop workbench route.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/support` - support tool mode.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic` - semantic tool mode.

The existing crop editor routes remain valid deep links and compatibility routes until the guided workflow replaces or redirects them:

- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support`
- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic`

The existing full-image editor route remains valid for default/full-image workflows and compatibility:

- `/app/projects/[projectId]/images/[imageId]/edit`

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
- RB-096 owns the unified crop workbench.
- RB-097 owns semantic-family exclusivity and classification guardrails.
- RB-098 owns smoke coverage and the final full-image editor boundary polish.
- Full-image mask editing is not removed by this decision, but crop-based annotation becomes the preferred staged workflow for multi-slice crop work.

## Evidence

- Current sprint overview: `tickets/crop-workflow-ux-orchestration-sprint/SPRINT-crop-workflow-ux-orchestration.md`
- Current RB-093 ticket: `tickets/crop-workflow-ux-orchestration-sprint/done/RB-093-crop-workflow-ux-state-machine-route-design.md`
- Crop workflow design: `docs/06-data/crop-based-slice-annotation.md`
- Current crop readiness resolver: `src/server/domain/cropReadiness.ts`
- Current full-image editor route: `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx`
- Current crop support route: `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support/page.tsx`
- Current crop semantic route: `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic/page.tsx`
