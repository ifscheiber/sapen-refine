# Future Prediction-Assisted Annotation

## Purpose

This page documents the RB-054 future workflow contract. Prediction-assisted annotation is not implemented at runtime yet.

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

No implementation files exist yet for this workflow. Current mask MVP files are under `src/mask` and current mask APIs are under `src/app/api/images/[imageId]/mask`.

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

- No prediction import API exists.
- No uncertainty/ranking queue exists.
- No Core handoff contract exists.
- No model-run/provenance registry exists.

## Related Tickets / Docs

- [../architecture/decisions/ADR-0001-sapen-annotate-naming.md](../architecture/decisions/ADR-0001-sapen-annotate-naming.md)
- [../06-data/model-prediction-contract.md](../06-data/model-prediction-contract.md)
- [../06-data/active-learning-task-model.md](../06-data/active-learning-task-model.md)
