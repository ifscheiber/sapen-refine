# Domain Boundaries

## Purpose

This page defines product and domain boundaries for the planned annotation model.

## SaPen Annotate Owns

SaPen Annotate owns standalone ground-truth annotation workflows:

- annotation projects,
- project membership,
- immutable raw image assets,
- acquisition and sample metadata,
- semantic material masks,
- slice support/instance masks,
- slice classifications,
- annotation tasks and sessions,
- review/approval state,
- export batches and manifests,
- model-run and prediction-run provenance for future assisted correction,
- attribution and audit records for annotation actions.

## SaPen Annotate Does Not Own

SaPen Annotate does not own SaPen Core experiment semantics or production reporting semantics.

Future integration with SaPen Core must use explicit contracts:

- training-data export,
- future Core-to-Annotate handoff,
- future model prediction import.

Core integration must not imply that Annotate projects are Core experiments.

## Ground-Truth Boundary

Human-reviewed annotation artifacts become ground truth only through explicit review state.

Model predictions, prefilled masks, active-learning priorities, and imported proposals are inputs. They are not ground truth until a human workflow creates and approves a separate artifact version.

RB-054 documents this as a design contract and RB-056 implements the provenance registry. Prediction artifacts may guide work queues or editor overlays, but approved human artifact/classification versions remain the only default training-export labels.

## Mask Boundary

Semantic material masks and slice support/instance masks are separate domain concepts.

Copper-specific rule:

Copper semantic masks identify copper-stained/penetrated material. They do not identify the whole physical slice and must not be used as support geometry unless a separate derived support artifact is created through documented rules.

## Access Boundary

Project membership is the default access boundary.

Planned permissions:

- annotate: create or edit draft/submitted artifacts,
- review: approve, reject, or supersede submitted artifacts,
- export: create immutable export batches,
- administer: manage project policy and membership.

Server-side authorization must enforce these permissions.

## Documentation Boundary

`docs/` is the source of truth for implementation-level facts. If `ARCHITECTURE.md` and `docs/` disagree, update both and treat `docs/` as authoritative.

## Related Docs

- [../06-data/annotation-domain-model.md](../06-data/annotation-domain-model.md)
- [../06-data/prisma-schema-proposal.md](../06-data/prisma-schema-proposal.md)
- [../06-data/training-export-contract.md](../06-data/training-export-contract.md)
- [../06-data/model-prediction-contract.md](../06-data/model-prediction-contract.md)
- [../06-data/active-learning-task-model.md](../06-data/active-learning-task-model.md)
