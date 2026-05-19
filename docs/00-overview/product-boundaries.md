# Product Boundaries

SaPen Annotate is a standalone annotation application for training-data creation. It is not a SaPen Core subtree and must not inherit Core experiment semantics implicitly.

Current product scope:

- local authentication and session handling,
- annotation projects and memberships,
- image upload and viewing,
- mask editing, saving, and latest-version loading.

Deferred product scope:

- final annotation metadata model,
- review and approval,
- dataset exports and manifests,
- prediction-assisted refine/correction mode,
- explicit SaPen Core handoff contracts.

Files of record: `src/app`, `src/server`, `src/mask`, `prisma/schema.prisma`, and `docs/adr/remediation-backlog.md`.
