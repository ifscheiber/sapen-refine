# Known Gaps

This page summarizes known limitations after the RB-040 through RB-045 baseline work.

## Current Gaps

- Validation baseline is green: `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, and `npm run check:design-hardcoding` pass.
- RB-045 resolved the previous editor hook dependency warnings.
- RB-046 migrated the deprecated Next.js `middleware.ts` convention to `src/proxy.ts`; the production build no longer reports that warning.
- Current Prisma schema is MVP-level and does not yet model final annotation metadata, tasks, review/approval, label schemas, or export batches.
- Mask terminology still includes legacy refinement-oriented names such as `MaskKind.REFINED`.
- Upload and commit routes have RB-046 size limits and app-mediated trial upload paths, but still need stronger storage/object metadata validation, checksums, image dimension validation, and audit events.
- Admin export and manifest reproducibility are not implemented.
- Editor UX is consolidated under `src/features/editor`; RB-045 added the browser/iPad trial baseline, while advanced iPad zoom/pan gestures remain deferred.
- Editor browser smoke is documented manually; automated golden-path browser coverage is deferred.
- Prediction-assisted refine/correction mode is planned but not implemented.

## Intentional Remaining "Refine" References

- `docs/workflows/future-prediction-assisted-annotation.md` uses "refine/correction" for a planned prediction-assisted workflow.
- `prisma/schema.prisma`, the current development baseline migration, and current mask route handlers still contain `MaskKind.REFINED` as legacy MVP schema terminology pending a domain migration ticket.
- Completed or historical tickets may mention the previous `sapen-refine` name for context.

## Related Tickets / Docs

- [adr/remediation-backlog.md](adr/remediation-backlog.md)
- [architecture/decisions/ADR-0001-sapen-annotate-naming.md](architecture/decisions/ADR-0001-sapen-annotate-naming.md)
