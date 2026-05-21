# Workflows

## Purpose

This folder documents user-facing annotation workflows.

## Important Files

- [annotation-from-scratch.md](annotation-from-scratch.md) - current primary workflow.
- [future-prediction-assisted-annotation.md](future-prediction-assisted-annotation.md) - prediction-assisted correction contract; the filename is historical, while semantic/support correction is partially implemented.

## Public Interfaces / Routes / Functions

Workflow pages link to relevant app routes and APIs.

## Invariants And Constraints

- Scratch annotation is the primary product mode.
- Prediction-assisted correction must never overwrite human ground truth.

## Known Gaps

- Review/approval exists as a minimal RB-052 editor/API workflow.
- Training export exists as an RB-053 project-level MVP; advanced export filters/history remain deferred.
- Prediction-assisted correction is designed by RB-054 and now has RB-056 provenance storage, RB-057 prediction mask import, RB-058 correction queues, RB-059 assisted editor correction, RB-060 prediction-analysis export, RB-061 batch prediction imports, and RB-065 single-host batch runner hardening. Running inference, metrics dashboards, and production-scale workers remain deferred.

## Related Tickets / Docs

- [../known-gaps.md](../known-gaps.md)
