# ADR-003 - Annotation Domain Model

## Status

Accepted for RB-048 design. First persistence baseline implemented by RB-049.

## Context

SaPen Annotate now has a green technical baseline, app-mediated browser upload/read paths, desktop browser E2E coverage, and documented iPad validation constraints.

The current MVP schema in `prisma/schema.prisma` is sufficient for login, projects, image upload, mask drawing, save, and latest-mask reload. It is not sufficient for exportable training data because it lacks label schema versions, structured metadata, task state, review/approval, export manifests, and clear separation between semantic material masks and support/instance geometry.

`MaskKind.REFINED` was legacy MVP terminology and does not define the standalone annotation model. RB-049 removed it from the active schema.

## Decision

Adopt a standalone annotation-domain model for RB-049+:

- projects are annotation projects, not SaPen Core experiments,
- raw image assets are immutable after commit,
- label schemas use stable machine-readable ids and versioned semantic meanings,
- semantic material masks, support/instance masks, slice classifications, predictions, reviews, and exports are separate concepts,
- review/approval is core to ground-truth state,
- approved/exported artifacts reference immutable exact versions,
- model predictions are provenance-bearing proposals and never overwrite human ground truth.

Copper semantic masks remain material annotations only. They must not be treated as physical slice support geometry.

## Consequences

- RB-049 implements schema changes from the proposal rather than extending the MVP `MaskKind.REFINED` model directly.
- Existing MVP routes may need compatibility handling or a clean development reset during schema implementation.
- Export implementation can target semantic segmentation, support/instance segmentation, slice classification, or combined manifest exports without conflating their artifacts.
- Active-learning and model preprediction can fit later through task priority, task reason, confidence/uncertainty, and prediction provenance.

## Deferred Work

- API and UI workflow migration.
- Review/approval UI and route handlers.
- Training export manifest implementation.
- Model preprediction/active-learning workflow.
- Stronger artifact checksum/dimension/object validation.

## Evidence

- Current schema: `prisma/schema.prisma`
- Current editor: `src/features/editor/EditorClient.tsx`
- Current mask labels: `src/mask/labels.ts`
- Current mask upload/latest routes: `src/app/api/images/[imageId]/mask/*`
- Current image upload/read routes: `src/app/api/projects/[projectId]/images/*`, `src/app/api/images/[imageId]/*`
- Target docs: `docs/06-data/annotation-domain-model.md`, `docs/06-data/prisma-schema-proposal.md`
