# Workflows

## Purpose

This folder documents user-facing annotation workflows.

## Important Files

- [annotation-from-scratch.md](annotation-from-scratch.md) - current primary workflow.
- [future-prediction-assisted-annotation.md](future-prediction-assisted-annotation.md) - planned future refine/correction workflow.

## Public Interfaces / Routes / Functions

Workflow pages link to relevant app routes and APIs.

## Invariants And Constraints

- Scratch annotation is the primary product mode.
- Prediction-assisted correction must never overwrite human ground truth.

## Known Gaps

- Review/approval and export workflows are planned but not implemented.

## Related Tickets / Docs

- [../known-gaps.md](../known-gaps.md)
