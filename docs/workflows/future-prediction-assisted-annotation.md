# Future Prediction-Assisted Annotation

## Purpose

This page documents the prediction-assisted workflow contract. RB-056 implements provenance registry storage, RB-057 implements one-at-a-time prediction mask import, and RB-058 implements the first correction task queue. Assisted editor behavior is not implemented yet.

## Planned Flow

A future model may provide prediction masks, slice-classification proposals, or uncertainty-ranked queues. Human users review and correct those predictions, then save separate human artifact/classification versions with explicit provenance.

Planned flow:

```text
prediction imported
-> correction task created
-> annotator opens task
-> prediction loads as read-only overlay or explicit starting point
-> human correction saved as DRAFT
-> submitted
-> approved or rejected through review workflow
-> approved human version becomes export-ready
```

## Important Files

Current provenance and queue implementation files:

- `prisma/schema.prisma` - `ModelRun`, `PredictionRun`, `PredictionArtifactProvenance`, and task links.
- `src/server/domain/predictionProvenance.ts` - provenance registry service layer.
- `src/server/domain/predictionImport.ts` - prediction mask import service.
- `src/server/domain/correctionTasks.ts` - correction task creation, ordering, role checks, and updates.
- `src/app/api/model-runs/*` and `src/app/api/projects/[projectId]/prediction-runs/route.ts` - minimal provenance APIs.
- `src/app/api/prediction-runs/[predictionRunId]/predictions/route.ts` - one-at-a-time prediction mask import API.
- `src/app/api/prediction-runs/[predictionRunId]/correction-tasks/route.ts`, `src/app/api/projects/[projectId]/correction-tasks/route.ts`, and `src/app/api/correction-tasks/[taskId]/route.ts` - correction task queue APIs.
- `src/app/(workspace)/app/projects/[projectId]/tasks/page.tsx` - project correction task queue route.

Current mask MVP files are under `src/mask`; current human mask APIs are under `src/app/api/images/[imageId]/mask`.

Design docs:

- `docs/06-data/model-prediction-contract.md`
- `docs/06-data/active-learning-task-model.md`
- `docs/08-adr/ADR-004-model-preprediction-active-learning.md`

## Invariants And Constraints

- Predicted masks must never overwrite human ground truth.
- Prediction provenance should include model/run/checkpoint/config where available.
- Default training export excludes predictions and includes only approved human ground-truth versions.
- Human corrections should link back to source prediction versions.
- "Refine" refers to this future correction workflow only, not the product or package name.

## Known Gaps

- No Core handoff contract exists.
- No assisted correction editor workflow exists.

## Related Tickets / Docs

- [../architecture/decisions/ADR-0001-sapen-annotate-naming.md](../architecture/decisions/ADR-0001-sapen-annotate-naming.md)
- [../06-data/model-prediction-contract.md](../06-data/model-prediction-contract.md)
- [../06-data/active-learning-task-model.md](../06-data/active-learning-task-model.md)
