# ADR-003 - Annotation Domain Model

## Status

Accepted for RB-048 design. First persistence baseline implemented by RB-049; metadata, default-slice, review, export, prediction-design, artifact-integrity, provenance, prediction import, correction, prediction-analysis export, and batch import slices implemented by RB-050 through RB-061.

## Context

SaPen Annotate now has a green technical baseline, app-mediated browser upload/read paths, desktop browser E2E coverage, and documented iPad validation constraints.

The original MVP schema was sufficient for login, projects, image upload, mask drawing, save, and latest-mask reload, but not for exportable training data. RB-049 through RB-061 now add label schema versions, structured metadata, default slice support/classification, minimal review/approval, owner-only export generation, a prediction/active-learning design contract, checksum/dimension/object validation, model/prediction provenance, prediction mask import, correction queues, assisted correction, prediction-analysis exports, and batch prediction import bookkeeping. Production-scale workflow hardening remains separate tickets.

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
- Active-learning and model preprediction fit through task priority, task reason, confidence/uncertainty, and prediction provenance; RB-056 through RB-061 implement the first proposal/correction path, RB-065 hardens the single-host runner, RB-066 adds temporary staging/orphan cleanup, and RB-067 adds prediction-analysis QA metrics.

## Deferred Work

- Full API/UI workflow depth beyond the current MVP slices.
- Advanced export filters/history/job handling.
- Production-scale prediction workers, cleanup UI, metric dashboards/reports, and slice-classification prediction correction.
- Broader audit coverage and security hardening beyond current artifact write paths.

## Evidence

- Current schema: `prisma/schema.prisma`
- Current editor: `src/features/editor/EditorClient.tsx`
- Current mask labels: `src/mask/labels.ts`
- Current mask upload/latest routes: `src/app/api/images/[imageId]/mask/*`
- Current review routes: `src/app/api/images/[imageId]/review-state/route.ts`, `src/app/api/artifact-versions/[versionId]/review/route.ts`, `src/app/api/slice-classification-versions/[versionId]/review/route.ts`
- Current image upload/read routes: `src/app/api/projects/[projectId]/images/*`, `src/app/api/images/[imageId]/*`
- Target docs: `docs/06-data/annotation-domain-model.md`, `docs/06-data/prisma-schema-proposal.md`, `docs/06-data/model-prediction-contract.md`
