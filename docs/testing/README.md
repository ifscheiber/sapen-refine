# Testing And Quality Gates

## Purpose

This page defines the current validation baseline and the intended testing direction.

## Current Commands

- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run check:docs-links`
- `npm run check:design-hardcoding`
- `npm run handoff:archive -- --dry-run` for RB-069 clean handoff packaging.
- `npm run test:e2e` after `npm run build` when local PostgreSQL/MinIO are running and seeded.
- `npm run test:e2e:ipad-prep` for the non-device iPad viewport/manifest preparation smoke.

## Current Unit Coverage

- `tests/integration/annotation-domain-schema.test.ts` covers RB-049 domain persistence invariants against local PostgreSQL: default label schema, image/project ownership, semantic/support artifact separation, Copper-not-support logic, attribution, and export references.
- `tests/integration/metadata-workflow.test.ts` covers RB-050 image metadata persistence, editable role behavior, viewer rejection, and rejection of immutable upload facts.
- `tests/integration/slice-workflow.test.ts` covers RB-051 default slice creation, support-mask artifact versions, classification versions, viewer rejection, dimension checks, and semantic-as-support rejection.
- `tests/integration/slice-bbox-workflow.test.ts` covers RB-086/DESIGN-006/RB-129 BBox proposal creation, viewer mutation rejection, invalid geometry rejection, overlap rejection for create/replace/confirm, dependency protection for semantic/support/classification-bearing BBoxes, explicit downstream annotation invalidation by superseding protected dependencies, append-only replacement, deletion by deleted-version append, active-list reload behavior, `SliceInstance.boundingBox` current-summary updates, and RB-094 image-level BBox set confirmation/needs-update behavior.
- `tests/integration/version-allocation-concurrency.test.ts` covers RB-107 concurrent append-only version allocation for crop support masks, crop semantic masks plus derived classifications, default slice classifications, and stale BBox replacement conflicts.
- `tests/integration/slice-crop-workflow.test.ts` covers RB-087 derived crop generation from stored source PNGs, default 32 px clipped padding, sanitized metadata without storage keys, app-mediated crop asset reads, viewer mutation rejection, stale/deleted BBox rejection, crop versioning per slice instance, and RB-095 slice navigator summaries for confirmed BBoxes/current crops.
- `tests/integration/crop-support-mask-workflow.test.ts` covers RB-088 crop support-mask artifact version creation, crop/slice/source-image lineage, `CROP_PIXEL` dimensions, sanitized latest-version reloads, viewer read-only behavior, dimension mismatch rejection, and RB-123 support-vs-Sapwood/Heartwood annotation-family locking.
- `tests/integration/crop-semantic-mask-workflow.test.ts` covers RB-089/RB-100 crop semantic-mask creation, supportless Sap/Heartwood semantics, Copper supportless drafts, mode-aware support policy, optional support-mask version lineage, `CROP_PIXEL` dimensions, sanitized latest-version reloads, viewer rejection, Copper outside-support rejection, invalid mode label rejection, wrong-lineage rejection, support-mask immutability, RB-090 save-time auto classification/manual override provenance, and RB-123 byte-derived annotation-family lock/conflict/readiness guardrails.
- `tests/integration/review-workflow.test.ts` covers RB-052 semantic/support/classification review transitions, permission checks, reject reason handling, review decisions, and latest-approved export readiness.
- `tests/integration/review-export-db-constraints.test.ts` covers RB-109 PostgreSQL check constraints for review decision exact-one targets and current export item role/reference matrix rows, including raw invalid inserts and valid review/export reference shapes.
- `tests/integration/export-workflow.test.ts` covers export readiness, async RB-112 enqueue/process completion, EX-002 manifest-only training exports and audited private materialization refs, EX-003/EX-004 SaPen-CNN snapshots with crop-level classification, shared splits, Sap/Heartwood and Copper crop semantic items, skipped labels, and overlap warnings, concurrent processor claim safety, approved-only selection, manifest/package contents, exact image/artifact/classification references, owner-only access, RB-121 Annotator/`LABELER` readiness denial, the Copper-not-support invariant, RB-055 export audit events, blocking missing integrity metadata, RB-105 stored-byte checksum/size mismatch failure states for full-image artifacts and derived crops, RB-091 crop training export readiness/manifest/package behavior, supportless Sap/Heartwood `SEMANTIC_FOREGROUND` crop export, and RB-092 shared crop readiness behavior for ready, incomplete, unapproved, auto-needs-approval, manual-current, manual-stale, lineage-mismatched, and coordinate-mismatched crop candidates.
- `tests/integration/prediction-provenance.test.ts` covers RB-056 model-run admin authorization, project-scoped prediction-run access, RB-121 Annotator/`LABELER` and viewer prediction-run denial, duplicate inference ids, prediction artifact provenance, classification prediction proposals, correction-task provenance links, and the rule that predictions are not ground-truth export inputs.
- `tests/integration/prediction-import.test.ts` covers RB-057 semantic/support prediction imports, `OWNER`/`QA` authorization, project boundaries, checksum/dimension/content-type/coordinate-space/value validation, audit creation, review rejection, and export exclusion for imported predictions.
- `tests/integration/prediction-import-batches.test.ts` covers RB-061/RB-065 ZIP batch creation, private item staging, partial success/failure summaries, stable item error codes, retry reset behavior, bounded process-due worker passes, stale lease recovery, processor audit identity, idempotent reprocessing, role authorization, staging-key response sanitization, unsupported target rejection, and export exclusion for imported predictions.
- `tests/integration/storage-cleanup.test.ts` covers RB-066/RB-114 dry-run/execute cleanup for terminal batch staging objects, active/retryable object protection, missing terminal staging as a cleanup-only finding, purged failed item retry exclusion, presigned orphan cleanup, durable raw-image/artifact/export protection, cleanup audit events, additive consistency reporting, report-only export orphans, stale export-job warnings, and hard drift for missing protected objects or completed export checksum/size mismatches.
- `tests/integration/correction-task-queue.test.ts` covers RB-058/RB-121 idempotent correction-task creation from prediction provenance, deterministic active-learning ordering, sanitized responses without storage keys, project role rules, `LABELER`/Annotator denial for correction-task operations, owner/QA task claim/start/dismiss/priority updates, and default active-queue filtering.
- `tests/integration/assisted-correction.test.ts` covers RB-059/RB-121 correction context authorization, `LABELER`/Annotator denial for assisted-correction APIs, prediction-mask reads, semantic/support `HUMAN_CORRECTION` saves, parent/task links, task status transitions through review, source prediction immutability, export eligibility for approved human corrections, and unsupported classification correction.
- `tests/integration/prediction-analysis-export.test.ts` covers RB-060/RB-067/RB-112 prediction-analysis export readiness, RB-121 Annotator/`LABELER` readiness denial, async enqueue/process completion, download authorization, proposal manifest safety language, model/prediction provenance, confidence/uncertainty metadata, separated prediction/human/ground-truth package paths, semantic/support QA metrics, missing-reference/not-computed reasons, Copper-not-support metrics boundaries, training export route separation, and manifest-only classification prediction proposals.
- `tests/integration/auth-hardening.test.ts` covers RB-064 DB-backed hashed login throttling, lockout, and successful bucket clearing.
- `tests/integration/high-cost-rate-limit.test.ts` covers RB-111 DB-backed high-cost write limiter persistence, over-threshold rejection, and window reset behavior.
- `tests/unit/mask-serialize.test.ts` covers mask serialization round trips and invalid headers.
- `tests/unit/auth-hardening.test.ts` covers RB-064 central permission helpers, login redirect sanitization, same-origin mutation guard decisions, and session last-seen throttling.
- `tests/unit/metadata-validation.test.ts` covers RB-050 metadata parsing, completeness/readiness calculation, and immutable-field validation.
- `tests/unit/review-domain.test.ts` covers RB-052 review transition helpers, role capability mapping, reject reason requirements, and approved-only export readiness.
- `tests/unit/slice-domain.test.ts` covers RB-051 support artifact kind helpers, latest classification resolution, RB-086/DESIGN-006 BBox validation and overlap helpers, RB-094 BBox workflow status resolution, RB-087 derived crop padding/geometry helpers, RB-088 crop support-mask coordinate/dimension helpers, RB-089/RB-100 crop semantic dimension/support-policy/mode helpers, RB-090 semantic-mask classification derivation rules, and RB-097 semantic-family detection/reset helpers.
- `tests/unit/crop-slice-navigator.test.ts` covers RB-095/DESIGN-009 slice navigator ordering, missing/current/stale crop status resolution, selected-slice route/status model composition, and read-only crop placement/mask preview metadata exposure.
- `tests/unit/crop-navigator-preview.test.ts` covers DESIGN-009 right-rail navigator viewport autofit, source-to-viewport BBox percent mapping, indexed semantic preview colors, and support-contour extraction.
- `tests/unit/crop-annotation-family.test.ts` covers RB-123 byte-level annotation-family occupancy detection for Sapwood/Heartwood, Copper, and support masks.
- `tests/unit/crop-mask-operations.test.ts` covers RB-102/DESIGN-015 shared crop brush/polygon operations, support-constrained Copper polygon/brush mutations, support coverage checks for existing Copper foreground, and unconstrained crop-space fills.
- `tests/unit/editor-canvas-geometry.test.ts` covers editor coordinate mapping, coordinate clamping, fit zoom, display sizing helpers, PERF-016 BBox preview sizing and original/preview coordinate mapping, PERF-017 preview-native BBox zoom bounds, RB-086 image-rectangle normalization from pointer points, and DESIGN-006 BBox hit/move/resize/overlap geometry helpers.
- `tests/unit/app-shell-context.test.ts` covers DESIGN-008 editor-route parsing and active-image-first sidebar image sorting.
- `tests/unit/project-recency.test.ts` covers DESIGN-012/DESIGN-013 project last-opened cookie parsing, promotion, visible-project filtering, and sidebar fallback sorting.
- `tests/unit/relative-time.test.ts` covers DESIGN-012 compact relative-time labels shared by shell/sidebar and image workspace displays.
- `tests/unit/workspace-tabs.test.ts` covers stable workspace tab keys when multiple editor tabs share a fallback route.
- `tests/unit/editor-helpers.test.ts` covers RB-068 extracted editor API path builders, review/classification/correction display helpers, abort detection, pointer ignore decisions, RB-070 eraser tool/value behavior, RB-080 exact editor mask upload payload construction for large masks and typed-array views, and RB-089/RB-100 crop semantic brush mutation.
- `tests/unit/runtime-config.test.ts` covers server runtime config defaults, required variables, upload limit parsing, and the RB-087 slice crop padding default/preset validation.
- `tests/unit/high-cost-rate-limit.test.ts` covers RB-111 rate-limit family policy mapping plus allow/deny/retry calculations.
- `tests/unit/high-cost-route-inventory.test.ts` guards representative expensive mutation routes so they remain wired to the shared high-cost limiter.
- `tests/unit/export-trial-caps.test.ts` covers RB-111 export item/byte cap decisions and stable cap error metadata.
- `tests/unit/sapen-cnn-materializer.test.ts` covers EX-005 local SaPen-CNN dataset materialization from a minimal snapshot fixture, including crop classification CSVs, crop semantic mask remapping, 32-bit TIFF instance masks, object caching, checksum mismatch failure, invalid semantic-label failure, overlap failure, and unsafe overwrite rejection.
- `tests/unit/storage-cleanup.test.ts` covers RB-066 temporary-object key classification, retention cutoffs, and age calculations.
- `tests/unit/storage-cleanup-route-contract.test.ts` pins the `/api/storage-cleanup` response shape so RB-114 consistency data remains additive and existing `cleanup.summary` / `cleanup.results` consumers keep working.
- `tests/unit/prediction-import-batch-leases.test.ts` covers RB-065 lease expiry, stale legacy processing detection, and retry/fail recovery state selection.
- `tests/unit/prediction-analysis-metrics.test.ts` covers RB-067 binary support IoU/Dice, semantic per-label/macro metrics, confusion matrix counts, empty-union behavior, unknown byte handling, support label lookup, not-computed payloads, and dimension mismatch handling.
- `tests/unit/upload-validation.test.ts` covers image/mask upload size validation, `413` payloads, SHA-256 checksum normalization, PNG/JPEG dimension parsing, image content-type rejection, trial image editability limits, mask dimension checks, support-mask value validation, RB-080 diagnostic-only declared mask byte length handling, and RB-081 shared raw mask request reading for 6000x4000 / 24,000,000-byte bodies plus truncated-body rejection.
- RB-118 is design-only. Future upload content-safety implementation tests must cover quarantine/staging, scan unavailable/timeout/reject outcomes, decode/re-encode and metadata stripping, rejected-upload audit rows without file contents, quarantine cleanup, and stable API error codes.
- `tests/unit/content-disposition.test.ts` covers RB-069 safe image/export download filenames, CR/LF injection removal, quote/backslash handling, ASCII fallback, and UTF-8 `filename*`.
- `tests/unit/handoff-archive.test.ts` covers RB-069/RB-110 archive exclusion policy, env/example handling, path filtering, handoff manifest summaries, arbitrary ZIP validation, forbidden-path detection, traversal/absolute path rejection, and safe failure output without payload contents.
- `tests/unit/deployment-hygiene.test.ts` covers RB-073 Docker build-context exclusions, the Compose MinIO init command/script hygiene, RB-081 Next proxy body-limit wiring, RB-084 Docker OpenSSL coverage for Prisma stages, and RB-130 trial app-service propagation for high-cost write limits/export caps.
- `tests/unit/mask-upload-route-contracts.test.ts` covers RB-081/RB-088/RB-089 route-level use of the shared raw mask upload reader across semantic, default support, crop support, crop semantic, and assisted-correction save paths.
- `tests/unit/client-api-contracts.test.ts` covers RB-074 browser helper route targets, removal of stale presign/commit exports, app-mediated image/semantic/support mask upload headers, and latest-mask response sanitization without private storage keys.
- `tests/unit/health-readiness.test.ts` covers health payloads and dependency readiness aggregation.
- `tests/unit/api-errors.test.ts` covers RB-072 API error mapping, unauthorized normalization, unknown-error sanitization, and wrapper behavior.
- `tests/unit/version-allocation.test.ts` covers RB-107 advisory-lock helper behavior and Prisma `P2002` normalization to `VERSION_ALLOCATION_CONFLICT`.
- `tests/unit/api-route-error-contracts.test.ts` covers RB-106 route classification and enforces `withApiErrorHandling` on every protected API route method.
- `tests/unit/audit-coverage-matrix.test.ts` covers RB-116 audit matrix governance by scanning every API mutation route, checking known operational entrypoints, and enforcing controlled classification values from `docs/testing/audit-coverage-matrix.md`.
- `tests/unit/cli-secret-handling.test.ts` covers RB-117 script secret precedence, file/env/stdin input, deprecated `--password` warnings without secret echo, script help output, and active docs avoiding password command arguments.
- `tests/unit/docs-link-governance.test.ts` covers RB-119 local Markdown link governance for `AGENTS.md`, `ARCHITECTURE.md`, `docs/**/*.md`, and `tickets/2026-05-23/README.md`; it resolves links relative to the source file and intentionally ignores external URLs.
- `tests/unit/proxy-public-paths.test.ts` covers public operational/auth/browser-asset paths, protected workspace paths, RB-072 unauthenticated API JSON `401`, RB-079 workspace path forwarding, page redirects, and same-origin guard precedence.
- `tests/unit/workspace-redirect.test.ts` covers RB-079 workspace login `next` target preservation and fallback behavior.

## Current E2E Coverage

- `tests/e2e/desktop-browser-smoke.spec.ts` covers the desktop MVP browser path: login, project creation, project operations navigation without the retired project Images action, PNG image upload through the upload dialog with validated technical metadata, single missing T-number list signal before metadata is entered, annotate-image crop workflow entry without legacy editor links, BBox autosave plus tab-switch slice preparation, absence of the redundant Classification tab/manual crop classification controls, RB-127 absence of Unknown/manual crop commit/polygon apply controls, supportless Sap/Heartwood crop semantic autosave/review/classification approval, async crop training export queue/process/polling through `/app/projects/[projectId]/exports` with manifest/package links, prediction-import route reachability, and a small assisted-correction path from prediction task to saved human correction draft.
- `tests/e2e/annotator-surface.spec.ts` covers the RB-121/RB-122 Annotator/`LABELER` browser surface: no project creation/settings/images/exports/tasks/prediction-import navigation, hidden operational status counts, image upload entry, metadata link visibility, and crop workflow entry.
- `tests/e2e/crop-workflow-closeout.spec.ts` covers the RB-098/RB-123/DESIGN-014/DESIGN-015/RB-127 crop workflow closeout gaps: Copper semantic drafts autosave before explicit support but remain non-ready until support/semantic/classification review is complete, redundant Classification and Support Mask tabs/manual crop classification controls stay hidden, Support is selected as a Cu-family label with support-only tools, keyboard polygon completion replaces manual Apply/Close buttons, and active Sapwood/Heartwood annotation disables the Cu family.
- `tests/e2e/missing-resource-soft-landing.spec.ts` covers RB-082/RB-104/RB-122 browser-page behavior for removed legacy editor URLs, unknown workspace URLs, the retired project Images workspace redirect, and project/image metadata mismatches.
- `tests/e2e/large-mask-upload.spec.ts` covers a synthetic valid 6000x4000 PNG entering the crop workflow, using a downscaled BBox-stage preview while saving original-coordinate BBoxes, using tab-switch slice preparation, confirming the redundant Classification tab/manual crop classification controls remain absent, and autosaving a crop-sized semantic mask rather than using the removed full-image editor route.
- `tests/e2e/slice-bbox-proposals.spec.ts` covers RB-086/DESIGN-006/RB-129 editor BBox proposal creation, DESIGN-008 image-scoped editor breadcrumbs/sidebar behavior, icon-only BBox toolbar behavior without Add/Resize buttons, empty-canvas deselection, direct canvas draw/select/move re-entry editing without global unlock, RB-094 crop workflow BBox-stage route/tab-switch slice preparation/open behavior, RB-095/RB-096/RB-101/RB-123 slice navigation into the unified crop annotation editor, DESIGN-009 embedded right-rail navigator visibility without visible BBox number badges, RB-103 BBox-stage re-entry from the crop editor, persistence through `/api/images/[imageId]/slice-bboxes`, RB-087/RB-101 crop generation/ensure behavior, crop preview visibility, and reload visibility.
- `tests/e2e/api-error-contracts.spec.ts` covers RB-072/RB-106 browser/API-level JSON errors for unauthenticated project access, stale API sessions, authenticated forbidden/not-found cases across export, image metadata, prediction run, and storage cleanup routes, plus BBox validation/conflict-like domain failures. It also covers RB-105 disabled legacy presign/commit upload route errors and RB-079 stale workspace session redirect behavior.
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
- API route-handler tests remain selective; RB-072 adds unit/proxy/E2E coverage for API error contracts, RB-106 adds a route-inventory guard for protected API wrapper coverage, and RB-116 adds an audit coverage matrix guard for all API mutation routes plus curated operational entrypoints. DB/domain integration coverage now protects annotation-domain persistence, metadata, slice/support, review, export, RB-055 export integrity behavior, RB-056 prediction provenance rules, RB-057 prediction import rules, RB-058 correction task queue rules, RB-059 assisted correction boundaries, RB-060/RB-067 prediction-analysis export separation and QA metrics, RB-061/RB-065 batch import processing/idempotency/stale-recovery rules, RB-064 auth throttle persistence, RB-066 temporary storage cleanup safety rules, and RB-107 safe append-only version allocation under concurrent writes. RB-069 adds unit coverage for handoff and filename-header hygiene. RB-118 leaves public upload content-safety behavior unimplemented pending follow-up tests.
- Real iPad Safari smoke remains manual and deferred until deployment/device access is available; `npm run test:e2e:ipad-prep` is preparation only.
- RB-086/RB-087/RB-088/RB-089/RB-090/RB-096/RB-097/RB-100/RB-123 add crop-sprint runtime coverage for source-image BBox proposal validation, persistence, derived crop generation, clipped padding, private crop reads, unified crop editor routing, crop support-mask lineage/dimensions, mode-aware crop semantic masks, byte-derived annotation-family conflict guardrails, save-time auto classification, manual overrides, and editor reload. RB-091/RB-092 add crop-aware export and central readiness coverage. RB-095 adds crop workflow navigator coverage for selected-slice URL state and per-slice status composition. RB-098/RB-123 add browser closeout coverage for Copper readiness and annotation-family lock UX. RB-103 adds browser coverage for BBox-stage re-entry after crop inspection. RB-104 removes the legacy full-image editor route from E2E paths; general interactive crop-mask reprojection into source-image space remains deferred, while EX-003/EX-004 add export-time SaPen-CNN full-image instance reconstruction coverage.

## Related Tickets / Docs

- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
- [audit-coverage-matrix.md](audit-coverage-matrix.md)
