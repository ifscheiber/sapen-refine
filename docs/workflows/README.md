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

- Review/approval exists as a minimal RB-052 editor/API workflow.
- Training export exists as an RB-053 project-level MVP; advanced export filters/history remain deferred.
- Prediction-assisted correction is designed by RB-054, has RB-056 provenance storage, and has RB-057 prediction mask import; queues and assisted editor UI remain deferred.

## Related Tickets / Docs

- [../known-gaps.md](../known-gaps.md)
