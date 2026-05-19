# Known Gaps

This page summarizes known limitations after the RB-040 through RB-053 baseline, metadata workflow, slice-support workflow, review/approval workflow, and training export MVP work.

## Current Gaps

- Validation baseline is green: `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, and `npm run check:design-hardcoding` pass.
- Desktop browser MVP smoke is automated through `npm run test:e2e`; real iPad Safari smoke remains deferred until deployment/device access is available.
- RB-045 resolved the previous editor hook dependency warnings.
- RB-046 migrated the deprecated Next.js `middleware.ts` convention to `src/proxy.ts`; the production build no longer reports that warning.
- RB-049 replaces the MVP Prisma schema with the first annotation-domain persistence baseline for label schemas, metadata structures, tasks/sessions, artifact versions, review decisions, slice classifications, and export records.
- RB-050 adds project/image metadata UI and APIs, image-level/default sample metadata capture, acquisition metadata capture, metadata readiness summaries, and desktop E2E coverage for metadata save/reload before editing.
- RB-051 adds one-default-slice workflow, separate `SLICE_SUPPORT_MASK` saving, slice classification versioning, and E2E coverage for semantic/support/classification persistence.
- RB-052 adds server-enforced submit/approve/reject transitions for semantic masks, support masks, and slice classifications, plus editor review controls and desktop E2E coverage for the owner approval happy path.
- RB-053 adds owner-only training export readiness, export batch creation, manifest/ZIP package generation, app-mediated download routes, integration coverage for manifest/package exact references, and E2E coverage for creating an export with manifest/package links.
- `MaskKind.REFINED` has been removed from the active Prisma schema; current editor saves map to draft semantic annotation artifacts.
- Upload and commit routes have RB-046 size limits and app-mediated trial upload paths. RB-047 routes normal browser reads through the app as well, and RB-050 stores checksums for app-mediated image uploads. Stronger storage/object metadata validation, checksum enforcement, image dimension validation, and audit events remain open in RB-055.
- RB-050 `SampleMetadata` is image-level/default metadata only. RB-051 creates a default `SliceInstance`, but slice-specific sample metadata remains deferred.
- Training export remains an MVP: synchronous, owner-only, project-level, and without advanced filters, export history UI, QA export policy, or large dataset job handling.
- Editor UX is consolidated under `src/features/editor`; RB-045 added the browser/iPad trial baseline, while advanced iPad zoom/pan gestures remain deferred.
- Copper semantic masks are material labels and must not be treated as physical slice support geometry. RB-051 adds the first support-mask workflow, but multi-object/multi-slice support remains deferred.
- Review/approval is intentionally minimal: no reviewer dashboard, bulk review, notification system, or multi-reviewer approval flow exists yet.
- Prediction-assisted refine/correction mode is planned but not implemented.

## Intentional Remaining "Refine" References

- `docs/workflows/future-prediction-assisted-annotation.md` uses "refine/correction" for a planned prediction-assisted workflow.
- Completed historical tickets may mention `MaskKind.REFINED`; the active Prisma schema no longer uses it.
- Completed or historical tickets may mention the previous `sapen-refine` name for context.

## Related Tickets / Docs

- [adr/remediation-backlog.md](adr/remediation-backlog.md)
- [architecture/decisions/ADR-0001-sapen-annotate-naming.md](architecture/decisions/ADR-0001-sapen-annotate-naming.md)
