# Known Gaps

This page summarizes known limitations after the RB-040 repository hygiene baseline.

## Current Gaps

- Validation baseline is red: `npm run lint` and `npm run build` fail on pre-existing issues.
- Current Prisma schema is MVP-level and does not yet model final annotation metadata, tasks, review/approval, label schemas, or export batches.
- Mask terminology still includes legacy refinement-oriented names such as `MaskKind.REFINED`.
- Upload and commit routes need stronger storage/object validation and audit events.
- Admin export and manifest reproducibility are not implemented.
- Editor UX needs consolidation and iPad/Pencil-focused work.
- Prediction-assisted refine/correction mode is planned but not implemented.

## Intentional Remaining "Refine" References

- `docs/workflows/future-prediction-assisted-annotation.md` uses "refine/correction" for a planned prediction-assisted workflow.
- `prisma/schema.prisma`, existing migrations, and current mask route handlers still contain `MaskKind.REFINED` as legacy MVP schema terminology pending a domain migration ticket.
- Completed or historical tickets may mention the previous `sapen-refine` name for context.

## Related Tickets / Docs

- [adr/remediation-backlog.md](adr/remediation-backlog.md)
- [architecture/decisions/ADR-0001-sapen-annotate-naming.md](architecture/decisions/ADR-0001-sapen-annotate-naming.md)
