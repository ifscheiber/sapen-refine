# Future Prediction-Assisted Annotation

## Purpose

This page documents planned terminology only. Prediction-assisted annotation is not implemented in RB-040.

## Planned Flow

A future model may provide prediction masks or uncertainty-ranked queues. Human users would review and correct those predictions, then save human-approved ground-truth mask versions with explicit provenance.

## Important Files

No implementation files exist yet for this workflow. Current mask MVP files are under `src/mask` and current mask APIs are under `src/app/api/images/[imageId]/mask`.

## Invariants And Constraints

- Predicted masks must never overwrite human ground truth.
- Prediction provenance should include model/run/checkpoint/config where available.
- "Refine" refers to this future correction workflow only, not the product or package name.

## Known Gaps

- No prediction input model exists.
- No uncertainty/ranking queue exists.
- No Core handoff contract exists.

## Related Tickets / Docs

- [../architecture/decisions/ADR-0001-sapen-annotate-naming.md](../architecture/decisions/ADR-0001-sapen-annotate-naming.md)
