# Known Gaps

This page summarizes known limitations after the RB-040 through RB-060 baseline, metadata workflow, slice-support workflow, review/approval workflow, training export MVP work, model preprediction/active-learning design, upload/artifact validation hardening, prediction provenance registry work, prediction mask import work, active-learning correction task queue work, assisted correction editor work, and prediction-analysis export work.

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
- RB-054 documents model prediction and active-learning contracts.
- RB-055 hardens app-mediated and compatibility image/mask write paths: PNG/JPEG image validation, mask dimension/byte validation, support-mask value validation, canonical SHA-256 checksums, object stat verification, sanitized stable errors, upload/artifact/export audit events, and export blocking for missing integrity metadata.
- RB-056 adds `ModelRun`, `PredictionRun`, and `PredictionArtifactProvenance` persistence, project-scoped prediction-run APIs, admin-only direct model-run APIs, and integration coverage for authorization, linkage, and prediction exclusion from ground-truth export.
- RB-057 adds a server-side multipart prediction mask import API for project `OWNER`/`QA`, validates image-sized `u8raw-v1` bytes, checksum, content type, coordinate space, semantic/support byte values, stores private `PREDICTION_MASK` artifacts with `MODEL_PREDICTION` provenance, and keeps predictions out of review/export ground truth.
- RB-058 adds idempotent active-learning correction task creation from prediction provenance, deterministic project task queue APIs, project task queue UI, role-aware claim/start/dismiss/priority actions, sanitized task responses, and integration coverage for the queue rules.
- RB-059 adds a route-addressable assisted correction editor, read-only prediction overlay, explicit prediction-to-editable-mask copy action, human correction draft saves with `HUMAN_CORRECTION` provenance, parent/task links, review-driven task status updates, and integration/E2E coverage for the core boundaries.
- RB-060 adds separate prediction-analysis exports for project `OWNER`/`QA`, a distinct manifest version, proposal warnings, model/prediction provenance, confidence/uncertainty metadata, and separated package paths for predictions, human corrections, and approved ground-truth references.
- `MaskKind.REFINED` has been removed from the active Prisma schema; current editor saves map to draft semantic annotation artifacts.
- Upload and commit routes have RB-046 size limits and app-mediated trial upload/read paths. RB-055 adds checksum, dimension, object stat, and audit hardening for the current raw-image, semantic-mask, support-mask, and export paths.
- RB-050 `SampleMetadata` is image-level/default metadata only. RB-051 creates a default `SliceInstance`, but slice-specific sample metadata remains deferred.
- Training export remains an MVP: synchronous, owner-only, project-level, and without advanced filters, export history UI, or large dataset job handling. Prediction-analysis export is also synchronous and trial-sized, but allows project `QA` in addition to `OWNER`.
- Editor UX is consolidated under `src/features/editor`; RB-045 added the browser/iPad trial baseline, while advanced iPad zoom/pan gestures remain deferred.
- Copper semantic masks are material labels and must not be treated as physical slice support geometry. RB-051 adds the first support-mask workflow, but multi-object/multi-slice support remains deferred.
- Review/approval is intentionally minimal: no reviewer dashboard, bulk review, notification system, or multi-reviewer approval flow exists yet.
- Prediction-assisted refine/correction mode is implemented for semantic/support mask predictions. RB-060 implements prediction-analysis export; RB-061 still covers batch/background imports.
- Prediction-analysis export does not compute metrics such as Dice/IoU or confusion matrices; offline evaluation/dashboard work remains deferred.
- Slice-classification prediction correction remains deferred.
- Remaining upload/security limits: no malware scanning, no rate limiting, no HA/object replication, no WebP/TIFF/SVG upload support, no background cleanup dashboard for orphaned objects, and no large async export/import job handling.

## Intentional Remaining "Refine" References

- `docs/workflows/future-prediction-assisted-annotation.md` uses "refine/correction" for a planned prediction-assisted workflow.
- Completed historical tickets may mention `MaskKind.REFINED`; the active Prisma schema no longer uses it.
- Completed or historical tickets may mention the previous `sapen-refine` name for context.

## Related Tickets / Docs

- [adr/remediation-backlog.md](adr/remediation-backlog.md)
- [architecture/decisions/ADR-0001-sapen-annotate-naming.md](architecture/decisions/ADR-0001-sapen-annotate-naming.md)
