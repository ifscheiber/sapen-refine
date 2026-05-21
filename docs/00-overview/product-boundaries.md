# Product Boundaries

SaPen Annotate is a standalone annotation application for training-data creation. It is not a SaPen Core subtree and must not inherit Core experiment semantics implicitly.

Current product scope:

- local authentication and session handling,
- annotation projects and memberships,
- validated image upload and viewing,
- image acquisition and default sample metadata,
- semantic material mask editing and saving,
- separate slice-support mask editing,
- slice classification,
- minimal review/approval state,
- approved training export manifests/packages,
- model/prediction provenance,
- prediction mask import,
- active-learning correction tasks,
- assisted correction for semantic/support mask predictions,
- prediction-analysis exports,
- trial-sized ZIP batch prediction imports,
- temporary staging/presigned-upload cleanup for the single-host trial.

Deferred product scope:

- multi-slice/multi-object editing and slice-specific sample metadata,
- reviewer dashboards, bulk review, and multi-reviewer policy,
- advanced export filters/history/background jobs,
- production-scale prediction batch workers and cleanup dashboards,
- prediction metrics dashboards,
- slice-classification prediction correction,
- explicit SaPen Core handoff contracts.

Files of record: `src/app`, `src/server`, `src/mask`, `prisma/schema.prisma`, and `docs/adr/remediation-backlog.md`.
