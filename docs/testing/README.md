# Testing And Quality Gates

## Purpose

This page defines the current validation baseline and the intended testing direction.

## Current Commands

- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run check:design-hardcoding`
- `npm run handoff:archive -- --dry-run` for RB-069 clean handoff packaging.
- `npm run test:e2e` after `npm run build` when local PostgreSQL/MinIO are running and seeded.
- `npm run test:e2e:ipad-prep` for the non-device iPad viewport/manifest preparation smoke.

## Current Unit Coverage

- `tests/integration/annotation-domain-schema.test.ts` covers RB-049 domain persistence invariants against local PostgreSQL: default label schema, image/project ownership, semantic/support artifact separation, Copper-not-support logic, attribution, and export references.
- `tests/integration/metadata-workflow.test.ts` covers RB-050 image metadata persistence, editable role behavior, viewer rejection, and rejection of immutable upload facts.
- `tests/integration/slice-workflow.test.ts` covers RB-051 default slice creation, support-mask artifact versions, classification versions, viewer rejection, dimension checks, and semantic-as-support rejection.
- `tests/integration/slice-bbox-workflow.test.ts` covers RB-086 BBox proposal creation, viewer mutation rejection, invalid geometry rejection, append-only replacement, deletion by deleted-version append, active-list reload behavior, and `SliceInstance.boundingBox` current-summary updates.
- `tests/integration/slice-crop-workflow.test.ts` covers RB-087 derived crop generation from stored source PNGs, default 32 px clipped padding, sanitized metadata without storage keys, app-mediated crop asset reads, viewer mutation rejection, stale/deleted BBox rejection, and crop versioning per slice instance.
- `tests/integration/crop-support-mask-workflow.test.ts` covers RB-088 crop support-mask artifact version creation, crop/slice/source-image lineage, `CROP_PIXEL` dimensions, sanitized latest-version reloads, viewer read-only behavior, and dimension mismatch rejection.
- `tests/integration/crop-semantic-mask-workflow.test.ts` covers RB-089 support-constrained crop semantic-mask creation, Sap/Heartwood and Copper modes, exact support-mask version lineage, `CROP_PIXEL` dimensions, sanitized latest-version reloads, viewer rejection, outside-support rejection, invalid mode label rejection, wrong-lineage rejection, support-mask immutability, and RB-090 save-time auto classification/manual override provenance.
- `tests/integration/review-workflow.test.ts` covers RB-052 semantic/support/classification review transitions, permission checks, reject reason handling, review decisions, and latest-approved export readiness.
- `tests/integration/export-workflow.test.ts` covers export readiness, approved-only selection, manifest/package contents, exact image/artifact/classification references, owner-only access, the Copper-not-support invariant, RB-055 export audit events, blocking missing integrity metadata, RB-091 crop training export readiness/manifest/package behavior, and RB-092 shared crop readiness behavior for ready, incomplete, unapproved, auto-needs-approval, manual-current, manual-stale, lineage-mismatched, and coordinate-mismatched crop candidates.
- `tests/integration/prediction-provenance.test.ts` covers RB-056 model-run admin authorization, project-scoped prediction-run access, duplicate inference ids, prediction artifact provenance, classification prediction proposals, correction-task provenance links, and the rule that predictions are not ground-truth export inputs.
- `tests/integration/prediction-import.test.ts` covers RB-057 semantic/support prediction imports, `OWNER`/`QA` authorization, project boundaries, checksum/dimension/content-type/coordinate-space/value validation, audit creation, review rejection, and export exclusion for imported predictions.
- `tests/integration/prediction-import-batches.test.ts` covers RB-061/RB-065 ZIP batch creation, private item staging, partial success/failure summaries, stable item error codes, retry reset behavior, bounded process-due worker passes, stale lease recovery, processor audit identity, idempotent reprocessing, role authorization, staging-key response sanitization, unsupported target rejection, and export exclusion for imported predictions.
- `tests/integration/storage-cleanup.test.ts` covers RB-066 dry-run/execute cleanup for terminal batch staging objects, active/retryable object protection, purged failed item retry exclusion, presigned orphan cleanup, durable raw-image/artifact/export protection, and cleanup audit events.
- `tests/integration/correction-task-queue.test.ts` covers RB-058 idempotent correction-task creation from prediction provenance, deterministic active-learning ordering, sanitized responses without storage keys, project role rules, task claim/start/dismiss/priority updates, and default active-queue filtering.
- `tests/integration/assisted-correction.test.ts` covers RB-059 correction context authorization, prediction-mask reads, semantic/support `HUMAN_CORRECTION` saves, parent/task links, task status transitions through review, source prediction immutability, export eligibility for approved human corrections, and unsupported classification correction.
- `tests/integration/prediction-analysis-export.test.ts` covers RB-060/RB-067 prediction-analysis export readiness/creation/download authorization, proposal manifest safety language, model/prediction provenance, confidence/uncertainty metadata, separated prediction/human/ground-truth package paths, semantic/support QA metrics, missing-reference/not-computed reasons, Copper-not-support metrics boundaries, training export route separation, and manifest-only classification prediction proposals.
- `tests/integration/auth-hardening.test.ts` covers RB-064 DB-backed hashed login throttling, lockout, and successful bucket clearing.
- `tests/unit/mask-serialize.test.ts` covers mask serialization round trips and invalid headers.
- `tests/unit/auth-hardening.test.ts` covers RB-064 central permission helpers, login redirect sanitization, same-origin mutation guard decisions, and session last-seen throttling.
- `tests/unit/metadata-validation.test.ts` covers RB-050 metadata parsing, completeness/readiness calculation, and immutable-field validation.
- `tests/unit/review-domain.test.ts` covers RB-052 review transition helpers, role capability mapping, reject reason requirements, and approved-only export readiness.
- `tests/unit/slice-domain.test.ts` covers RB-051 support artifact kind helpers, latest classification resolution, RB-086 BBox validation errors, RB-087 derived crop padding/geometry helpers, RB-088 crop support-mask coordinate/dimension helpers, RB-089 crop semantic dimension/support-constraint/mode helpers, and RB-090 semantic-mask classification derivation rules.
- `tests/unit/editor-canvas-geometry.test.ts` covers editor coordinate mapping, coordinate clamping, fit zoom, display sizing helpers, and RB-086 image-rectangle normalization from pointer points.
- `tests/unit/editor-helpers.test.ts` covers RB-068 extracted editor API path builders, review/classification/correction display helpers, abort detection, pointer ignore decisions, RB-070 eraser tool/value behavior, RB-080 exact editor mask upload payload construction for large masks and typed-array views, and RB-089 support-constrained crop semantic brush mutation.
- `tests/unit/runtime-config.test.ts` covers server runtime config defaults, required variables, upload limit parsing, and the RB-087 slice crop padding default/preset validation.
- `tests/unit/storage-cleanup.test.ts` covers RB-066 temporary-object key classification, retention cutoffs, and age calculations.
- `tests/unit/prediction-import-batch-leases.test.ts` covers RB-065 lease expiry, stale legacy processing detection, and retry/fail recovery state selection.
- `tests/unit/prediction-analysis-metrics.test.ts` covers RB-067 binary support IoU/Dice, semantic per-label/macro metrics, confusion matrix counts, empty-union behavior, unknown byte handling, support label lookup, not-computed payloads, and dimension mismatch handling.
- `tests/unit/upload-validation.test.ts` covers image/mask upload size validation, `413` payloads, SHA-256 checksum normalization, PNG/JPEG dimension parsing, image content-type rejection, trial image editability limits, mask dimension checks, support-mask value validation, RB-080 diagnostic-only declared mask byte length handling, and RB-081 shared raw mask request reading for 6000x4000 / 24,000,000-byte bodies plus truncated-body rejection.
- `tests/unit/content-disposition.test.ts` covers RB-069 safe image/export download filenames, CR/LF injection removal, quote/backslash handling, ASCII fallback, and UTF-8 `filename*`.
- `tests/unit/handoff-archive.test.ts` covers RB-069 archive exclusion policy, env/example handling, path filtering, and handoff manifest summaries.
- `tests/unit/deployment-hygiene.test.ts` covers RB-073 Docker build-context exclusions, the Compose MinIO init command/script hygiene, RB-081 Next proxy body-limit wiring, and RB-084 Docker OpenSSL coverage for Prisma stages.
- `tests/unit/mask-upload-route-contracts.test.ts` covers RB-081/RB-088/RB-089 route-level use of the shared raw mask upload reader across semantic, default support, crop support, crop semantic, and assisted-correction save paths.
- `tests/unit/client-api-contracts.test.ts` covers RB-074 browser helper route targets, removal of stale presign/commit exports, app-mediated image/semantic/support mask upload headers, and latest-mask response sanitization without private storage keys.
- `tests/unit/health-readiness.test.ts` covers health payloads and dependency readiness aggregation.
- `tests/unit/api-errors.test.ts` covers RB-072 API error mapping, unauthorized normalization, unknown-error sanitization, and wrapper behavior.
- `tests/unit/proxy-public-paths.test.ts` covers public operational/auth/browser-asset paths, protected workspace paths, RB-072 unauthenticated API JSON `401`, RB-079 workspace path forwarding, page redirects, and same-origin guard precedence.
- `tests/unit/workspace-redirect.test.ts` covers RB-079 workspace login `next` target preservation and fallback behavior.

## Current E2E Coverage

- `tests/e2e/desktop-browser-smoke.spec.ts` covers the desktop MVP browser path: login, project creation, project operations navigation, PNG image upload with validated technical metadata, single missing T-number list signal before metadata is entered, editor open without aborted-fetch console/page errors, semantic mask draw/erase/save, support mask draw/erase/save, slice classification save, submit/approve for all three reviewable units, reload, latest-artifact/review API checks, owner training export creation through `/app/projects/[projectId]/exports` with manifest/package links, prediction-import route reachability, and a small assisted-correction path from prediction task to saved human correction draft.
- `tests/e2e/missing-resource-soft-landing.spec.ts` covers RB-082 browser-page behavior for stale image editor URLs, unknown workspace URLs, project/image mismatches, and a still-valid uploaded image editor link.
- `tests/e2e/large-mask-upload.spec.ts` covers RB-080/RB-081 full-resolution editor upload behavior with a synthetic valid 6000x4000 PNG. It waits for editor readiness, draws a tiny semantic stroke, saves through the real app-mediated semantic mask route, and asserts the persisted latest mask size is 24,000,000 bytes.
- `tests/e2e/slice-bbox-proposals.spec.ts` covers RB-086 editor BBox proposal creation, persistence through `/api/images/[imageId]/slice-bboxes`, RB-087 crop generation through `/api/slice-bboxes/[bboxVersionId]/crop`, crop preview visibility, and reload visibility.
- `tests/e2e/api-error-contracts.spec.ts` covers RB-072 browser/API-level JSON errors for unauthenticated project access plus authenticated forbidden/not-found cases across export, image metadata, prediction run, and storage cleanup routes. It also covers RB-079 stale workspace session redirect behavior.
- `tests/e2e/ipad-viewport-prep.spec.ts` checks the iPad-sized Chromium viewport and Web App Manifest availability. It is preparation only and does not replace real iPad Safari testing.
- `playwright.config.ts` uses the system Chrome channel by default because Playwright's bundled Chromium download is not available for the current `ubuntu26.04-x64` environment.
- E2E prerequisites: local DB/MinIO running, migrations applied, seed/admin login available, and a current production build for the Playwright `next start` web server.
- Desktop smoke had one transient wait during baseline before RB-084 changes; focused retry and final full E2E passed. Track if repeated.

## Manual Smoke

- `docs/07-testing/manual-smoke-desktop-browser.md` defines the current desktop browser MVP smoke path.
- `docs/07-testing/manual-smoke-editor-ipad.md` defines the current desktop and iPad Safari editor trial checklist.
- `docs/07-testing/manual-smoke-customer-browser-trial.md` defines the deployment-oriented desktop and iPad Safari customer-trial checklist.
- `docs/07-testing/manual-smoke-ipad-safari-gate.md` is the authoritative real iPad Safari customer-pilot gate; execution is deferred in `tickets/deferred/RB-077-B-real-ipad-safari-trial-gate-execution.md` until deployed URL/device access exist.

## Baseline From RB-041

- `npm install` completed.
- `npm run prisma:generate` passed.
- `npm run lint` passed with warnings only.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run test` passed with the initial mask serialization unit tests.

## Preferred Test Order

- Route-handler/API integration tests for auth, project membership, image upload, mask commit, and latest mask loading.
- DB/domain tests for attribution, versioning, ownership, review state, and export manifests.
- Unit tests for mask serialization, label handling, coordinate spaces, and patch application.
- Focused UI/E2E tests for login, create project, upload image, annotate, save, reload, review, and export.

## Invariants And Constraints

- `npm run test` now includes a local PostgreSQL integration test. Local DB must be running, migrated, and seeded; `npm run db:rebuild` is the clean recovery path.
- No real network calls to external hosted services in tests.
- Use deterministic fixtures and clean up DB rows created by tests.
- Mock object storage where possible.

## Known Gaps

- Current tests cover stable mask serialization, editor canvas geometry utilities, and extracted editor helper utilities.
- Advanced iPad zoom/pan gestures remain deferred; RB-045 resolved previous editor hook lint warnings.
- API route-handler tests remain selective; RB-072 adds unit/proxy/E2E coverage for representative API error contracts. DB/domain integration coverage now protects annotation-domain persistence, metadata, slice/support, review, export, RB-055 export integrity behavior, RB-056 prediction provenance rules, RB-057 prediction import rules, RB-058 correction task queue rules, RB-059 assisted correction boundaries, RB-060/RB-067 prediction-analysis export separation and QA metrics, RB-061/RB-065 batch import processing/idempotency/stale-recovery rules, RB-064 auth throttle persistence, and RB-066 temporary storage cleanup safety rules. RB-069 adds unit coverage for handoff and filename-header hygiene.
- Real iPad Safari smoke remains manual and deferred until deployment/device access is available; `npm run test:e2e:ipad-prep` is preparation only.
- RB-086/RB-087/RB-088/RB-089/RB-090 add crop-sprint runtime coverage for source-image BBox proposal validation, persistence, derived crop generation, clipped padding, private crop reads, crop support-mask lineage/dimensions, support-constrained crop semantic masks, save-time auto classification, manual overrides, and editor reload. RB-091/RB-092 add crop-aware export and central readiness coverage; source-image-space crop-mask reprojection remains deferred.

## Related Tickets / Docs

- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
