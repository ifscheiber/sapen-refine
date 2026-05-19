# Known Gaps

This page summarizes known limitations after the RB-040 through RB-050 baseline and metadata workflow work.

## Current Gaps

- Validation baseline is green: `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, and `npm run check:design-hardcoding` pass.
- Desktop browser MVP smoke is automated through `npm run test:e2e`; real iPad Safari smoke remains deferred until deployment/device access is available.
- RB-045 resolved the previous editor hook dependency warnings.
- RB-046 migrated the deprecated Next.js `middleware.ts` convention to `src/proxy.ts`; the production build no longer reports that warning.
- RB-049 replaces the MVP Prisma schema with the first annotation-domain persistence baseline for label schemas, metadata structures, tasks/sessions, artifact versions, review decisions, slice classifications, and export records.
- RB-050 adds project/image metadata UI and APIs, image-level/default sample metadata capture, acquisition metadata capture, metadata readiness summaries, and desktop E2E coverage for metadata save/reload before editing.
- `MaskKind.REFINED` has been removed from the active Prisma schema; current editor saves map to draft semantic annotation artifacts.
- Upload and commit routes have RB-046 size limits and app-mediated trial upload paths. RB-047 routes normal browser reads through the app as well, and RB-050 stores checksums for app-mediated image uploads. Stronger storage/object metadata validation, checksum enforcement, image dimension validation, and audit events remain open in RB-055.
- RB-050 `SampleMetadata` is image-level/default metadata only. Slice-specific sample metadata remains deferred to the future `SliceInstance` workflow.
- Admin export generation and manifest reproducibility are not implemented, though `ExportBatch`/`ExportItem` persistence exists for RB-053.
- Editor UX is consolidated under `src/features/editor`; RB-045 added the browser/iPad trial baseline, while advanced iPad zoom/pan gestures remain deferred.
- Copper semantic masks are material labels; physical slice support/instance artifact kinds now exist, but the user workflow remains RB-051.
- Review/approval state is modeled in persistence; the user workflow remains RB-052.
- Prediction-assisted refine/correction mode is planned but not implemented.

## Intentional Remaining "Refine" References

- `docs/workflows/future-prediction-assisted-annotation.md` uses "refine/correction" for a planned prediction-assisted workflow.
- Completed historical tickets may mention `MaskKind.REFINED`; the active Prisma schema no longer uses it.
- Completed or historical tickets may mention the previous `sapen-refine` name for context.

## Related Tickets / Docs

- [adr/remediation-backlog.md](adr/remediation-backlog.md)
- [architecture/decisions/ADR-0001-sapen-annotate-naming.md](architecture/decisions/ADR-0001-sapen-annotate-naming.md)
