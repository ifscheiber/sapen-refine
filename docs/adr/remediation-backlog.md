# Remediation Backlog

Deferred work discovered during repository hygiene should be recorded here instead of expanding active ticket scope.

## RB-105 - Presigned Compatibility Upload Immutability Gap (Resolved)

Context: The legacy/internal image and semantic-mask presign/commit routes return presigned `PutObject` URLs for the final object keys that are later persisted in `ImageAsset.storageKey` or `AnnotationArtifactVersion.storageKey`. The app validates the object at commit time, but the presigned URL can still overwrite the same key until it expires. Export packaging then reads current object bytes from storage without recomputing the bytes against the persisted checksum before writing the ZIP package.

Impact: A client holding a still-valid presigned URL can mutate a committed raw image or committed mask object after database persistence. This violates raw-image/artifact immutability and can make DB checksums, export manifests, and ZIP package bytes disagree.

Resolution: Implemented by RB-105 optimized ticket. The image and mask presign/commit compatibility routes now authenticate and authorize the caller, then return stable `410 PRESIGNED_UPLOADS_DISABLED` JSON without issuing final-key presigned URLs, reading client-written objects, or persisting committed rows. Training, crop-training, and prediction-analysis ZIP packaging now reads object bytes through `getVerifiedExportObjectBytes` and compares actual bytes against persisted checksum and size before archive insertion.

Affected modules: `src/app/api/projects/[projectId]/images/presign`, `src/app/api/projects/[projectId]/images/commit`, `src/app/api/images/[imageId]/mask/presign`, `src/app/api/images/[imageId]/mask/commit`, `src/server/storage/s3.ts`, `src/server/domain/exports.ts`, storage docs, and compatibility-route tests.

Owner: Codex.

Priority: Resolved by RB-105.

## RB-106 - Protected API Error Contract Completion (Resolved)

Context: RB-072 added flat JSON API error helpers and representative route coverage, but many protected routes still call `requireUser()` or `requireProjectRole()` before a route-level `try/catch` or without `withApiErrorHandling`. A stale but present session cookie bypasses proxy missing-cookie handling and can still throw outside the stable API error contract.

Impact: Some customer-facing fetch/XHR failures can return generic framework errors instead of stable `{ ok: false, error: "UNAUTHENTICATED" }` or `FORBIDDEN` JSON responses. This weakens client error handling and makes production troubleshooting inconsistent.

Resolution: Implemented by RB-106 optimized ticket. Every protected `src/app/api/**/route.ts` HTTP method now exports through `withApiErrorHandling`, formerly unwrapped binary/download and domain routes return flat JSON on auth/domain failures before streaming, and `tests/unit/api-route-error-contracts.test.ts` inventories every route with public/protected classification. The guard fails when protected route methods are not wrapped or when a new route lacks classification.

Affected modules: `src/app/api/**/route.ts`, `src/server/http/apiErrors.ts`, API docs, and route/API contract tests.

Owner: Codex.

Priority: Resolved by RB-106.

## RB-107 - Artifact Version Allocation Concurrency Hardening (Resolved)

Context: Multiple save paths allocate artifact or classification version numbers by reading the latest version and inserting `latest + 1`. This pattern appears in full-image semantic masks, default support masks, crop support masks, crop semantic masks, slice classifications, assisted corrections, and prediction imports.

Impact: Two saves for the same artifact family or slice instance can race on unique constraints such as `@@unique([artifactId, version])` and `@@unique([sliceInstanceId, version])`. One save may fail after object storage writes have occurred, causing confusing save failures and storage churn. This risk increases with multi-tab editing or multiple annotators.

Resolution: Implemented by RB-107 optimized ticket. Append-only artifact, crop, BBox, prediction-import, assisted-correction, and slice-classification writers now use a shared PostgreSQL transaction-scoped advisory lock helper before reading the latest version and inserting the next row. Version-family conflicts normalize to stable `VERSION_ALLOCATION_CONFLICT` responses, and BBox replace/delete races return the existing `BBOX_VERSION_STALE` conflict. Remaining multi-tab UX warning is still deferred.

Affected modules: `src/app/api/images/[imageId]/mask/upload`, `src/server/domain/slices.ts`, `src/server/domain/cropSupportMasks.ts`, `src/server/domain/cropSemanticMasks.ts`, `src/server/domain/sliceClassifications.ts`, `src/server/domain/assistedCorrection.ts`, `src/server/domain/predictionImport.ts`, editor save UX, and save/versioning tests.

Owner: Codex.

Priority: Resolved by RB-107.

## RB-108 - Root Architecture Current-Flow Drift (Resolved)

Context: The 2026-05-23 combined deep review verified that `ARCHITECTURE.md` still lists `/app/projects/[projectId]/images/[imageId]/edit` as the current editor flow after RB-104 removed the legacy full-image editor route. The same root map still says "crop-aware exports/review integration" is a known workflow gap, even though crop training export, crop readiness, and crop review controls now exist. Lower-level docs such as `docs/src/app/routes.md`, `docs/known-gaps.md`, and `docs/08-adr/ADR-006-crop-workflow-ux-orchestration.md` are more current.

Impact: Agents and contributors start from `ARCHITECTURE.md`. Stale current-flow text can send future work toward dead routes, duplicate already-implemented crop review/export behavior, or misstate what remains deferred.

Resolution: Implemented by RB-108 optimized ticket. `ARCHITECTURE.md` now describes the current crop entry, BBox stage, slice navigator, selected crop workbench, crop support editor, crop semantic editor, and assisted-correction flows. The removed `/app/projects/[projectId]/images/[imageId]/edit` route is marked as historical/removed, and crop review/export gaps are narrowed to remaining dashboards, bulk review, export-history/filtering, async large-job handling, and source-image-space reprojection work.

Affected modules: `ARCHITECTURE.md`, `docs/src/app/routes.md`, `docs/known-gaps.md`, `docs/08-adr/ADR-006-crop-workflow-ux-orchestration.md`, and future docs route-sync checks.

Owner: Codex.

Priority: Resolved by RB-108.

## RB-109 - DB Constraint Hardening For Review And Export Integrity (Resolved)

Context: The 2026-05-23 combined deep review verified that several important persisted invariants are enforced by service code but not by the database. `ReviewDecision` allows nullable `artifactVersionId` and nullable `sliceClassificationVersionId` without a DB check that exactly one target is present. `ExportItem` stores nullable references plus a free-text `role`, while domain code controls valid role/reference combinations.

Impact: Current application paths are disciplined, but future scripts, migrations, manual maintenance, or new route handlers could create ambiguous review/export rows. Ambiguous records weaken auditability and export reproducibility and are harder to repair after customer data exists.

Resolution: Implemented by RB-109 optimized ticket. `ReviewDecision` now has a PostgreSQL exact-one-target check constraint, and current stable `ExportItem.role` values have named role/reference shape constraints backed by migration preflight checks. The role/reference matrix is documented in the Prisma schema docs, while target compatibility and cross-table lineage semantics remain in the export service layer.

Affected modules: Prisma migrations, `docs/prisma/README.md`, `docs/prisma/schema.md`, `src/server/domain/review.ts`, `src/server/domain/exports.ts`, `src/server/domain/predictionAnalysisExports.ts`, and export/review DB integration tests.

Owner: Codex.

Priority: Resolved by RB-109.

## RB-110 - External Handoff Archive Validation (Resolved)

Context: The ChatGPT deep review inspected an uploaded archive that contained `.env`, `.env.local`, and `.git`. The current git repo does not track those env files, and `scripts/create-handoff-archive.mjs` plus `docs/operations/handoff-zip-checklist.md` already exclude `.git`, `.env*` except examples, `node_modules`, `.next`, build output, reports, traces, and local volumes. The remaining gap is validating arbitrary externally supplied ZIP files that bypass the repo archive command.

Impact: A manually created review or customer archive can leak local credentials, git history/config, build artifacts, or large local state even when the repository itself is clean. This is a process/security issue rather than a tracked source-code defect, but it can become severe if such an archive is shared externally.

Resolution: Implemented by RB-110 optimized ticket. `npm run handoff:validate -- <archive.zip>` now scans arbitrary ZIP entry names without extracting or printing file contents, rejects forbidden handoff paths and suspicious traversal/absolute paths, and reuses the same exclusion policy as archive creation. The handoff checklist now requires validation for manual or externally supplied archives.

Affected modules: `scripts/create-handoff-archive.mjs`, `scripts/handoff-archive-policy.mjs`, `scripts/validate-handoff-archive.mjs`, `docs/operations/handoff-zip-checklist.md`, `package.json` scripts, and archive hygiene tests.

Owner: Codex.

Priority: Resolved by RB-110.

## RB-111 - High-Cost Write Rate Limits And Trial Caps (Resolved)

Context: Login throttling, same-origin mutation protection, upload byte checks, and stable API error contracts existed, but expensive authenticated write paths could still be called repeatedly. Synchronous training and prediction-analysis exports also lacked explicit item/byte caps before ZIP packaging.

Impact: A trial user or script could repeatedly trigger CPU, memory, DB, and object-storage work through uploads, editor saves, export creation, prediction-import processing, or cleanup/admin operations. Large export requests could also build unbounded packages inside the synchronous trial path.

Resolution: Implemented by RB-111 optimized ticket. High-cost mutation routes now use a shared PostgreSQL-backed limiter keyed by route family plus hashed user/scope buckets and return stable `429 RATE_LIMITED` JSON with retry metadata. Training, crop-training, and prediction-analysis export creation now checks configurable item and estimated-byte caps before ZIP package generation. Prediction batch upload/item caps remain enforced through the existing upload and manifest validation.

Affected modules: `src/server/http/highCostRateLimit.ts`, `src/server/http/apiErrors.ts`, `src/server/runtime/config.ts`, high-cost `src/app/api/**` mutation routes, `src/server/domain/exports.ts`, `src/server/domain/predictionAnalysisExports.ts`, Prisma migrations, deployment docs, and limiter/export-cap tests.

Owner: Codex.

Priority: Resolved by RB-111.

## RB-112 - Async Export Job Hardening (Resolved)

Context: RB-111 bounded export frequency and size, but training, crop-training, and prediction-analysis package generation still ran synchronously inside create requests.

Impact: Trial-sized caps prevented unbounded work, but slow exports still depended on route/proxy request lifetimes and had no observable processing lease, retry, or terminal job state.

Resolution: Implemented by RB-112 optimized ticket. Export create routes now enqueue `PENDING` `ExportBatch` jobs with exact snapshot references and return `202`. `/api/export-jobs/process-due` claims due jobs atomically, records processor/lease/retry metadata, verifies source object checksum/size before packaging, stores manifest/package checksum/size metadata, and exposes downloads only after `COMPLETED`. The project exports UI polls status and the `npm run exports:process` script supports single-host trial operation.

Remaining follow-up: The package writer still uses JSZip behind RB-111 caps. Streaming ZIP generation, export history dashboards, production queue infrastructure, and dedicated system-actor credentials remain future work.

Affected modules: `prisma/schema.prisma`, `src/server/domain/exports.ts`, `src/server/domain/predictionAnalysisExports.ts`, `src/server/domain/exportJobs.ts`, `src/server/domain/exportPackageWriter.ts`, `src/app/api/export-jobs/process-due/route.ts`, `src/features/projects/ProjectExportPanel.tsx`, `scripts/process-export-jobs.mjs`, export tests, and docs.

Owner: Codex.

Priority: Resolved by RB-112.

## RB-115 - System Actor Attribution Model ADR (Resolved)

Context: AGENTS.md requires production writes to be attributable to an authenticated user or explicitly identified system actor. RB-112 export jobs, RB-065 prediction import processing, and RB-114 cleanup/consistency reporting all use named authenticated users plus processor metadata, but the conceptual model was not documented.

Impact: Future scheduled workers, cleanup automation, audit coverage checks, and SaPen Core handoff could otherwise drift into ambiguous `createdById = null`, processor-only, or anonymous audit patterns.

Resolution: Implemented by RB-115 optimized ticket. ADR-007 adopts explicit actor-context semantics: current user foreign keys remain the request attribution, `processorId` and `processorRunId` are non-secret execution metadata, and future unattended or external-system work must add explicit `triggeredBy` / `performedBy` actor context before production use.

Remaining follow-up: RB-115-A is implemented with structured `AuditLog.details.actorContext`; RB-115-B should add unattended worker actor context, and RB-115-C should define external-system/Core handoff provenance before Core integration.

Affected modules: `docs/08-adr/ADR-007-system-actor-attribution-model.md`, auth/RBAC/audit docs, remediation backlog, RB-116 audit matrix planning, future worker scripts, and future Core handoff contracts.

Owner: Codex.

Priority: Resolved by RB-115; follow-ups are P2 before broader unattended automation/Core handoff.

## RB-116 - Audit Coverage Matrix And Guard (Resolved)

Context: New mutation routes and operational entrypoints could be added without classifying their durable audit mechanism, system actor context, or explicit exemption.

Impact: Audit coverage could regress silently as export workers, prediction imports, cleanup operations, and admin scripts evolve.

Resolution: Implemented by RB-116 optimized ticket. `docs/testing/audit-coverage-matrix.md` now classifies current API mutation methods, operational scripts, worker processor entrypoints, and high-cost rate-limit bucket writes. `tests/unit/audit-coverage-matrix.test.ts` scans API route exports and fails when a mutation method is missing from the matrix.

Remaining follow-up: RB-115-B and RB-115-C remain the broader unattended-worker and external-system provenance follow-ups. RB-116-A resolved the trial bootstrap and trial-user script attribution gap.

Affected modules: `docs/testing/audit-coverage-matrix.md`, `tests/unit/audit-coverage-matrix.test.ts`, audit/RBAC docs, ticket README, and current operational scripts.

Owner: Codex.

Priority: Resolved by RB-116; RB-116-A is P3 before production operations use of bootstrap scripts.

## RB-116-A - Trial Bootstrap Operator Attribution (Resolved)

Context: `scripts/trial-bootstrap.mjs` and `scripts/create-trial-user.mjs` can create roles, label schemas, users, memberships, and audit rows for customer-trial setup. Before RB-116-A, those audit rows did not include explicit operator/system actor context.

Impact: Customer-facing bootstrap operations could leave only anonymous or script-local audit details, weakening attribution for administrative setup actions.

Resolution: Implemented by RB-116-A. Trial bootstrap and trial-user scripts now require `SAPEN_OPERATOR_EMAIL` or `--operator-email` for customer-trial/prod use, support only an explicit local `system:local-bootstrap` fallback, and write RB-115-A-style `details.actorContext`.

Remaining follow-up: Remove deprecated `--password` compatibility for `scripts/create-trial-user.mjs` after RB-117's transition period. Broader unattended-worker and external-system provenance remain RB-115-B/RB-115-C.

Affected modules: `scripts/trial-bootstrap.mjs`, `scripts/create-trial-user.mjs`, `scripts/trial-bootstrap-lib.mjs`, CLI attribution tests, deployment/runtime docs, and `docs/testing/audit-coverage-matrix.md`.

Owner: Codex.

Priority: Resolved by RB-116-A.

## RB-117 - CLI Secret Handling Password Flag Deprecation (Resolved)

Context: Operator scripts for export jobs, prediction-import processing, storage cleanup, and trial-user creation accepted `--password` command-line arguments, and active docs included examples that normalized command-line password passing.

Impact: Password arguments can leak through shell history, terminal scrollback, process inspection, copied support commands, and CI logs.

Resolution: Implemented by RB-117 optimized ticket. Operator scripts now prefer file-mounted secrets, environment variables, and explicit stdin input before the deprecated `--password` compatibility flag. Help output documents the preferred inputs, deprecated `--password` emits a warning without the secret value, and active docs use file/env examples instead of password command arguments.

Remaining follow-up: Remove deprecated `--password` compatibility after customer-trial operator docs and automation no longer need the transition path. RB-116-A has separately resolved trial-bootstrap operator attribution.

Affected modules: `scripts/process-export-jobs.mjs`, `scripts/process-prediction-import-batch.mjs`, `scripts/storage-cleanup.mjs`, `scripts/create-trial-user.mjs`, deployment/runbook docs, deployment templates, and CLI secret handling tests.

Owner: Codex.

Priority: Resolved by RB-117; removal of compatibility is future P3 cleanup.

## RB-118 - Upload Content Safety Hardening Design (Resolved)

Context: Current upload routes enforce authenticated access, size limits, content-type checks, checksum/dimension validation, object stat verification, high-cost write limits, and private app-mediated storage. Those controls protect integrity and trial resource bounds but are not malware scanning or full content-safety controls.

Impact: Without a documented trust boundary, future deployment docs could overstate upload safety or expose broader/public uploads before quarantine, scanning, normalization, and rejection handling exist.

Resolution: Implemented by RB-118. ADR-008 accepts the current named-user customer-trial posture with explicit limitations and selects private quarantine/staging plus scan/promote as the required future direction before public or broad untrusted upload exposure.

Remaining follow-up: RB-118-A through RB-118-E cover quarantine/staging policy, decode/re-encode and metadata stripping, scanner integration, rejection audit/cleanup, and reverse-proxy upload-limit alignment.

Affected modules: `docs/08-adr/ADR-008-upload-content-safety.md`, upload/deployment/runtime docs, known-gaps docs, testing docs, and review-derived follow-up tickets.

Owner: Codex.

Priority: Resolved by RB-118 for design; implementation follow-ups are P2 before public upload exposure.

## RB-119 - Documentation Governance Polish After Deep Review (Resolved)

Context: The 2026-05-23 deep-review reports identified useful documentation governance polish after several higher-priority integrity, audit, export, and upload-safety tickets. Some early static findings, especially the `docs/README.md` broken-link claim, were false positives because links must resolve relative to the Markdown file that contains them.

Impact: Future agents could otherwise revive rejected findings, miss newer ADR/backlog locations, or mistake historical route/workflow references for current implementation paths.

Resolution: Implemented by RB-119. Documentation now distinguishes implemented secondary prediction/correction workflows from future SaPen Core handoff, indexes ADR-007/ADR-008 consistently, updates post-RB-118 current-state/readiness notes, and adds a governed local Markdown link check.

Remaining follow-up: Continue adding focused backlog/ticket entries for new governance gaps. RB-113 remains the separate real iPad Safari manual evidence gate, and RB-120 remains opportunistic maintainability work.

Affected modules: `AGENTS.md`, docs indexes and current-state/readiness docs, `tests/unit/docs-link-governance.test.ts`, `package.json`, and `tickets/2026-05-23/README.md`.

Owner: Codex.

Priority: Resolved by RB-119.

## RB-120 - Opportunistic Large Module Decomposition Map (Resolved)

Context: Deep reviews identified large, high-churn editor and server-domain modules as maintainability debt. After RB-107, RB-112, RB-114, RB-116, and RB-119, the main risk is accidental broad refactoring rather than a missing production feature.

Impact: Future changes to editor save state, crop canvas interaction, exports, prediction imports, storage cleanup, and governance guards could become riskier if engineers reshape large modules without clear boundaries or focused tests.

Resolution: Implemented by RB-120. `docs/01-architecture/opportunistic-decomposition-map.md` inventories current hotspots, identifies safe extraction seams, records activation conditions, and defines validation expectations without changing production behavior.

Remaining follow-up: RB-120-A through RB-120-F are deferred opportunistic extraction tickets. They should be activated only when a feature or bug fix already touches the affected area. RB-113, RB-115-B/C, and RB-118-A through RB-118-E remain separate.

Affected modules: `docs/01-architecture/opportunistic-decomposition-map.md`, architecture docs, known-gaps docs, sprint tickets, and future editor/export/prediction-import/storage-cleanup/governance work.

Owner: Codex.

Priority: Resolved by RB-120; follow-ups are P3 opportunistic unless a future feature makes one blocking.

## RB-085-A - Crop-Based Slice Annotation Runtime Implementation (Resolved)

Context: RB-085 originally documented a support-first crop-based slice annotation workflow after RB-081 made full-resolution large-mask saves viable inside trial bounds. RB-086 adds persistent source-image BBox proposal versions. RB-087 adds private derived crop PNG generation with `CROP_PIXEL` metadata. RB-088 adds crop support-mask editing and crop/slice/source-image artifact lineage. RB-089/RB-100 adds mode-aware crop semantic editing. RB-090 adds draft auto classification suggestions from crop semantic masks. RB-091 adds crop training export, and RB-092 adds shared crop readiness plus review integration.

Impact: Large images can still stress browser/iPad memory and server request buffering during full-image annotation. Crop-based annotation is needed for scalable multi-slice workflows while preserving source-image coordinate provenance.

Proposed next step: No remaining action for this backlog item. Source-image-space crop-mask reprojection, production-scale exports, and advanced reviewer dashboards remain separate future work.

Affected modules: `src/features/editor`, `src/app/api`, `src/server/domain`, `src/mask`, `prisma/schema.prisma`, docs under `docs/03-features` and `docs/06-data`.

Owner: Codex.

Priority: Resolved.

## RB-089-A - Explicit Sap/Heartwood Complement Fill

Context: RB-089 implements manual Sapwood/Heartwood/Unknown painting inside the crop support mask and documents complement fill as deferred. Complement fill was intentionally not added because the sprint slice focused on support-constrained persistence, lineage, server validation, and the first crop semantic editor.

Impact: Annotators must paint both Sapwood and Heartwood manually in crop semantic mode. This is correct but less efficient when one class is best represented as the complement of the other inside support.

Proposed next step: Add an explicit, user-triggered complement fill action in the crop semantic editor that fills remaining support pixels with the selected complementary class while preserving existing Unknown pixels and continuing to reject outside-support semantic foreground server-side.

Affected modules: `src/features/editor/CropSemanticEditorClient.tsx`, `src/mask/tools.ts`, `src/server/domain/cropSemanticMasks.ts`, crop semantic editor tests, and docs under `docs/03-features` and `docs/06-data`.

Owner: Unassigned.

Priority: P2.

## RB-040-A - Baseline Validation Is Not Green

Context: Baseline `npm run lint` failed before RB-040 changes. Baseline `npm run build` succeeded at compilation when network font access was available, then failed TypeScript in the pre-RB-043 prototype AppShell.

Impact: Future changes cannot rely on lint/build as green regression gates until existing errors are fixed.

Resolution: Fixed by RB-041. Root validation now includes `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test`.

Affected modules: deleted pre-RB-043 prototype shell/editor files, `src/components/ui/sidebar.tsx`, `src/mask/renderOverlay.ts`.

Owner: Codex.

Priority: Resolved.

## RB-040-B - MVP Mask Terminology Still Uses Refinement-Oriented Names

Context: The pre-RB-049 schema defined `MaskKind.PREDICTION` and `MaskKind.REFINED`.

Impact: The schema language does not yet reflect standalone scratch annotation, label schemas, review states, or export-ready ground truth.

Resolution: RB-048 documents the target annotation-domain model. RB-049 removes `MaskKind` and maps the current editor path to draft semantic annotation artifacts.

Affected modules: `prisma/schema.prisma`, `src/app/api/images/[imageId]/mask/*`, `src/mask/*`, docs under `docs/prisma` and `docs/src/mask`.

Owner: Codex.

Priority: Resolved by RB-049.

## RB-040-C - Upload And Commit Endpoint Hardening

Context: Current upload commit routes record object keys and basic metadata but do not fully verify object existence, image dimensions, checksums, or content type.

Impact: Training-data reproducibility and raw-image immutability are not strong enough for production.

Resolution: Implemented by RB-055. App-mediated and compatibility image/mask writes now validate PNG/JPEG images, raw mask bytes, checksums, dimensions, support-mask values, object stat metadata, stable errors, and audit events. Export creation blocks selected inputs with missing checksum/dimension integrity metadata.

Affected modules: `src/app/api/projects/[projectId]/images/*`, `src/app/api/images/[imageId]/mask/*`, `src/server/storage/*`, `prisma/schema.prisma`.

Owner: Codex.

Priority: Resolved by RB-055.

## RB-040-D - Admin Export And Manifest Workflow Missing

Context: SaPen Annotate is intended to export reviewed datasets, but no export batch or manifest workflow exists yet.

Impact: The app cannot yet produce reproducible training datasets.

Resolution: Implemented by RB-053. Project owners can create approved-only training exports with manifest/ZIP downloads and exact input references.

Affected modules: `prisma/schema.prisma`, `src/app/api`, `src/server`, future export docs.

Owner: Codex.

Priority: Resolved by RB-053.

## RB-040-E - Editor Consolidation And iPad/Pencil UX

Context: The current editor is MVP-oriented and not yet designed for reliable iPad/Pencil annotation across screen sizes.

Impact: Annotation ergonomics and data quality may suffer on tablet devices.

Resolution: RB-070 adds explicit eraser UX for semantic and support-mask editing. Advanced iPad/Pencil viewport interactions remain a later follow-up.

Affected modules: `src/features/editor/EditorClient.tsx`, `src/features/editor/EditImagePage.tsx`, `src/mask/*`, `src/design/editorCanvas.ts`.

Owner: Unassigned.

Priority: P2.

## RB-040-F - Dependency Audit Findings

Context: `npm install --package-lock-only` reported 26 audit findings: 13 moderate, 12 high, and 1 critical.

Impact: Dependency risk is not understood or remediated, and automated fixes may introduce breaking changes if handled inside an unrelated ticket.

Resolution: RB-042 ran `npm audit`, applied non-forced fixes, updated Next.js to `16.2.6`, and added a PostCSS override. The audit is reduced to 3 moderate Prisma CLI transitive findings.

Affected modules: `package.json`, `package-lock.json`, dependency tree.

Owner: Codex.

Priority: Resolved with follow-up below.

## RB-042-A - Remaining Prisma CLI Audit Findings

Context: After RB-042, `npm audit --json` reports 3 moderate findings: direct `prisma`, transitive `@prisma/dev`, and transitive `@hono/node-server`.

Impact: These affect the Prisma CLI/dev dependency chain. The app runtime dependency `@prisma/client` is not the reported vulnerable direct package.

Resolution: Fixed by RB-075. Prisma CLI/client/adapter are aligned on 7.8.x, `@hono/node-server` is narrowly overridden to `1.19.14`, and `npm audit --json` reports 0 vulnerabilities. `npm audit fix --force` was not used.

Affected modules: `package.json`, `package-lock.json`, Prisma CLI dependency chain.

Owner: Codex.

Priority: Resolved by RB-075.

## RB-041-A - Prototype Editor Lint Warnings

Context: RB-041 restored green lint/build/typecheck/test gates. RB-043 removed the duplicate shell/editor prototype components, but ESLint still reports non-blocking hook dependency warnings in the active editor client.

Impact: The warnings do not fail validation, but they obscure future lint output and point at code that should be simplified during architecture/UI cleanup.

Resolution: Fixed by RB-045. `npm run lint` now passes without editor hook dependency warnings.

Affected modules: `src/features/editor/EditorClient.tsx`.

Owner: Codex.

Priority: Resolved.

## RB-041-B - Next Middleware Convention Warning

Context: `npm run build` passes but reports that the `middleware` file convention is deprecated in favor of `proxy`.

Impact: This is not a current failure, but it should be cleaned up before larger routing work.

Resolution: Fixed by RB-046. `src/middleware.ts` was replaced with `src/proxy.ts`, public health/readiness and browser asset paths are allowlisted, and `npm run build` no longer reports the convention warning.

Affected modules: `src/middleware.ts`, routing docs.

Owner: Codex.

Priority: Resolved.

## RB-045-A - Advanced iPad Zoom And Pan Gestures

Context: RB-045 hardens the existing editor for Pointer Events, touch targets, fit/zoom controls, and iPad smoke testing. It intentionally does not implement a larger multi-touch gesture model.

Impact: Large images may still require manual zoom-slider and scroll-container interaction instead of native-feeling two-finger zoom/pan on iPad.

Proposed next step: Design and implement a dedicated editor viewport interaction model for touch devices, covering two-finger pan/zoom, Pencil drawing isolation, and predictable coordinate mapping.

Affected modules: `src/features/editor/EditorClient.tsx`, `src/features/editor/canvasGeometry.ts`, future editor viewport helpers, and editor smoke docs.

Owner: Unassigned.

Priority: P2.

## RB-045-B - Automated Browser Smoke For Editor Golden Path

Context: RB-045 adds a manual smoke checklist for desktop and iPad Safari. The repo does not yet have Playwright or equivalent browser automation.

Impact: Login, upload, open-editor, draw, save, and reload were manually verified workflows.

Resolution: Fixed by RB-047. `npm run test:e2e` now covers login, project creation, upload, editor open, draw, save, reload, and latest-mask existence.

Affected modules: future browser tests, `src/app/(workspace)/app/projects/**`, `src/features/images/*`, `src/features/editor/*`, and local storage/test fixtures.

Owner: Codex.

Priority: Resolved.

## RB-049 - Annotation Domain Schema Implementation

Context: RB-048 defines the target domain model. RB-049 implements the first persistence baseline in `prisma/schema.prisma`.

Impact: Follow-up feature work can now build on the schema baseline; review, export, prediction design, and artifact validation have MVP slices, while runtime prediction workflows and multi-slice workflows still need later tickets.

Resolution: Implemented by RB-049 optimized ticket with `AnnotationProject`, `ImageAsset`, label schemas, tasks/sessions, artifact versions, review decisions, slice classifications, and export records.

Affected modules: `prisma/schema.prisma`, `prisma/migrations`, `src/app/api`, `src/server`, `src/mask`, docs under `docs/06-data` and `docs/prisma`.

Owner: Codex.

Priority: Resolved.

## RB-050 - Project, Image, And Sample Metadata Workflow

Context: RB-049 adds `ImageAsset`, `ImageAcquisitionMetadata`, and `SampleMetadata`, but the current image workflow still captures only basic file metadata.

Impact: Training exports cannot carry enough metadata for reproducible customer/lab datasets.

Resolution: Implemented by RB-050 optimized ticket. Project metadata edit/display, image metadata detail route, acquisition metadata edit, image-level/default sample metadata edit, T-number visibility, metadata readiness summaries, and desktop E2E coverage are in place.

Remaining follow-up: Slice-specific sample metadata remains deferred to `SliceInstance` or a later normalized sample entity.

Affected modules: `src/features/images`, `src/features/projects`, `src/app/api/projects/[projectId]`, `src/app/api/projects/[projectId]/images/*`, `src/app/api/images/[imageId]/metadata`, `src/server/domain/metadata.ts`, docs under `docs/03-features` and `docs/06-data`.

Owner: Codex.

Priority: Resolved.

## RB-051 - Slice Classification And Support-Mask Workflow

Context: RB-049 adds support/instance artifact kinds and slice classification persistence. The app does not yet expose the user workflow for physical slice support/instance geometry or slice classifications.

Impact: Copper semantic masks could be misused as support geometry unless the domain workflow separates these artifacts.

Resolution: Implemented by RB-051 optimized ticket. The app now supports one default `SliceInstance` per image, separate `SLICE_SUPPORT_MASK` artifact versions, editor support-mask mode, and draft `SliceClassificationVersion` writes.

Remaining follow-up: Multi-object/multi-slice editing, true slice-specific sample metadata, reviewer dashboards, bulk review, and export generation remain deferred.

Affected modules: `src/features/editor`, `src/mask`, `src/app/api/images/[imageId]/slice/*`, `src/app/api/images/[imageId]/support-mask/*`, `src/server/domain/slices.ts`, docs under `docs/03-features` and `docs/06-data`.

Owner: Codex.

Priority: Resolved.

## RB-052 - Review And Approval Workflow

Context: RB-049 adds review/approval persistence, but the app had no draft/submitted/approved/rejected workflow.

Impact: Without this workflow, the app could not identify approved training artifacts or preserve reviewer attribution.

Resolution: Implemented by RB-052 optimized ticket. Semantic mask versions, slice support mask versions, and slice classification versions can now be submitted, approved, or rejected with append-only review decisions. The editor shows minimal review controls and approved-version export readiness.

Remaining follow-up: Reviewer dashboards, bulk review, notifications, and multi-reviewer approval remain deferred.

Affected modules: `src/app/api/images/[imageId]/review-state`, `src/app/api/artifact-versions/[versionId]/review`, `src/app/api/slice-classification-versions/[versionId]/review`, `src/server/domain/review.ts`, `src/features/editor`, `prisma/schema.prisma`, docs under `docs/03-features`, `docs/06-data`, and `docs/testing`.

Owner: Codex.

Priority: Resolved.

## RB-053 - Admin Training Export MVP

Context: RB-049 adds export batch/item persistence. RB-048 defines semantic segmentation, support/instance segmentation, slice classification, and combined manifest export targets. Before RB-053, no export generation existed.

Impact: The app cannot produce reproducible training-data bundles.

Resolution: Implemented by RB-053 optimized ticket and moved to the dedicated project exports route by RB-063. RB-112 later changed package creation to async jobs. Project owners can enqueue training exports; the export workflow records an `ExportBatch`, exact `ExportItem` references, a manifest checksum, package checksum/size metadata, warnings, and actor attribution. Downloads are served through app routes without exposing private MinIO URLs.

Remaining follow-up: Advanced export filters, export history/dashboard UI, QA export policy, streaming package generation, and production-scale queue infrastructure remain deferred.

Affected modules: `src/server/domain/exports.ts`, `src/app/api/projects/[projectId]/export/readiness`, `src/app/api/projects/[projectId]/exports`, `src/app/api/exports/[exportId]`, `src/features/projects/ProjectExportPanel.tsx`, `tests/integration/export-workflow.test.ts`, `tests/e2e/desktop-browser-smoke.spec.ts`, and docs under `docs/03-features`, `docs/04-server`, `docs/06-data`, and `docs/testing`.

Owner: Codex.

Priority: Resolved.

## RB-054 - Model Preprediction And Active-Learning Design

Context: RB-048 reserves task priority, uncertainty/confidence, model source, and task reason concepts for future model-assisted workflows.

Impact: Prediction-assisted annotation could compromise ground-truth integrity if model proposals are not modeled separately.

Resolution: Implemented by RB-054 optimized ticket. Prediction artifacts are documented as proposals only, not ground truth. Future human corrections must create separate human versions, active-learning queue ordering is documented, and RB-053 export remains approved-human-only.

Remaining follow-up: RB-061/RB-065 now cover trial-sized batch imports and the single-host worker path. Advanced model metrics, production-scale workers, and dashboards remain deferred.

Affected modules: future prediction import services, annotation tasks, editor workflow, export variants, docs under `docs/06-data`, `docs/03-features`, `docs/workflows`, and `docs/08-adr`.

Owner: Codex.

Priority: Resolved.

## RB-055 - Upload Artifact Validation And Checksum Hardening

Context: RB-049 added checksum/dimension fields. Before RB-055, upload routes had size limits and app-mediated browser paths, but still needed object metadata verification, checksum enforcement, dimensions, and stronger audit events.

Impact: Before RB-055, raw-image immutability and artifact reproducibility were weaker than required for customer training data.

Resolution: Implemented by RB-055 optimized ticket. Central upload integrity helpers now compute canonical SHA-256 checksums, parse PNG/JPEG dimensions, validate `u8raw-v1` mask size/dimensions, validate support-mask byte values, verify stored object metadata, and normalize stable error responses. Upload, mask, support-mask, and export paths emit audit events. Export creation fails with `EXPORT_INTEGRITY_METADATA_MISSING` when selected approved inputs lack checksum/dimension metadata.

Affected modules: `src/app/api/projects/[projectId]/images/*`, `src/app/api/images/[imageId]/mask/*`, `src/server/storage/*`, `src/server/uploads/*`, `prisma/schema.prisma`, docs under `docs/04-server` and `docs/06-data`.

Owner: Codex.

Priority: Resolved.

## RB-056 - Prediction Provenance And ModelRun Registry

Context: RB-054 concludes that `AnnotationTask.modelSource` is not sufficient for reproducible model provenance.

Impact: Prediction imports would be difficult to audit or reproduce without structured run/checkpoint/config metadata.

Resolution: Implemented by RB-056 optimized ticket. The schema now includes `ModelRun`, `PredictionRun`, `PredictionArtifactProvenance`, prediction task links, model/prediction target/status enums, minimal domain services and APIs, and integration tests for authorization, linkage, classification proposals, and export exclusion.

Remaining follow-up: RB-061/RB-065 now cover batch import jobs and the single-host worker path. Advanced model metrics, production-scale workers, and dashboards remain deferred.

Affected modules: `prisma/schema.prisma`, `src/server/domain/predictionProvenance.ts`, `src/app/api/model-runs/*`, `src/app/api/projects/[projectId]/prediction-runs/route.ts`, `src/app/api/prediction-runs/[predictionRunId]/route.ts`, tests and docs under `docs/06-data`.

Owner: Codex.

Priority: Resolved.

## RB-057 - Prediction Import API And Storage Validation

Context: RB-054 defines prediction artifacts as proposals, and RB-055 hardens the current object validation helpers.

Impact: The app cannot safely ingest model-generated prediction artifacts yet.

Resolution: Implemented by RB-057 optimized ticket. The app now has a multipart prediction mask import route, validates `u8raw-v1` bytes/checksum/dimensions/content type/coordinate space/target-specific values, stores private `PREDICTION_MASK` artifact versions with `MODEL_PREDICTION` provenance, links `PredictionArtifactProvenance`, records audit events, and keeps predictions out of review/export ground truth.

Remaining follow-up: RB-061/RB-065 now handle batch imports and the single-host worker path. Advanced model metrics, production-scale workers, and dashboards remain deferred.

Affected modules: `src/server/domain/predictionImport.ts`, `src/app/api/prediction-runs/[predictionRunId]/predictions/route.ts`, `src/server/storage`, `src/server/uploads`, tests, and docs under `docs/06-data`.

Owner: Codex.

Priority: Resolved.

## RB-058 - Active-Learning Task Queue API And UI

Context: RB-054 defines task reasons and deterministic queue ordering, but no queue APIs or UI exist.

Impact: Annotators cannot act on model uncertainty or correction-task priority.

Resolution: Implemented by RB-058 optimized ticket. The app creates idempotent correction tasks from prediction provenance, exposes deterministic project task queue APIs/UI, and supports role-aware claim/start/dismiss/priority actions.

Affected modules: future task APIs, project/task UI, RBAC, docs under `docs/03-features` and `docs/06-data`.

Owner: Codex.

Priority: Resolved.

## RB-059 - Assisted Correction Editor Workflow

Context: RB-054 defines the future editor behavior for prediction overlays and human correction layers.

Impact: Prediction-backed tasks cannot be corrected in the editor without risking mutation of prediction artifacts or confusion with human ground truth.

Resolution: Implemented by RB-059 optimized ticket. Prediction-backed semantic/support tasks open a route-addressable correction editor, prediction masks remain read-only, and saved corrections create separate `HUMAN_CORRECTION` artifact versions linked to source prediction and task.

Affected modules: `src/features/editor`, future task route/API integrations, `src/mask`, docs under `docs/03-features`.

Owner: Codex.

Priority: Resolved.

## RB-060 - Prediction Analysis Export Mode

Context: RB-053 ground-truth exports intentionally exclude model predictions. RB-054 allows a future QA/prediction-analysis export only as a separate target.

Impact: Teams may need to inspect model predictions and confidence data without contaminating ground-truth training exports.

Resolution: Implemented by RB-060 optimized ticket. Prediction-analysis exports use `ExportTarget.PREDICTION_ANALYSIS`, distinct API routes, a distinct manifest version, explicit proposal warnings, `ExportItem.predictionProvenanceId`, owner/QA authorization, and separate prediction/human/ground-truth package paths.

Affected modules: `src/server/domain/predictionAnalysisExports.ts`, `src/server/domain/exports.ts`, `src/app/api/projects/[projectId]/prediction-analysis-*`, `src/app/api/prediction-analysis-exports/*`, `src/features/projects/ProjectExportPanel.tsx`, `prisma/schema.prisma`, export docs and tests.

Owner: Codex.

Priority: Resolved.

## RB-061 - Batch Prediction Import And Background Jobs

Context: RB-054 identifies large prediction imports as unsuitable for long synchronous route-handler or browser requests.

Impact: Larger customer or model-evaluation datasets need retryable, attributable import bookkeeping.

Resolution: Implemented by RB-061 optimized ticket. The schema now includes `PredictionImportBatchJob` and `PredictionImportBatchItem`; ZIP batch creation validates a versioned manifest and privately stages files; processing calls the RB-057 import service; item errors/retry state are persisted; owner/QA APIs and a project UI expose sanitized status without storage keys.

Remaining follow-up: RB-065 now covers the single-host worker/lease/stale-recovery path, RB-066 covers temporary staging/orphan cleanup, and RB-063 covers project operations route consolidation. Slice-classification batch imports, prediction metrics dashboards, cleanup UI, and production-scale queue infrastructure remain deferred.

Affected modules: `prisma/schema.prisma`, `src/server/domain/predictionImportBatches.ts`, `src/app/api/prediction-runs/[predictionRunId]/batch-imports`, `src/app/api/prediction-import-batches/*`, `src/features/projects/ProjectPredictionImportBatchPanel.tsx`, deployment/runtime docs, and tests.

Owner: Codex.

Priority: Resolved.

## RB-062 - Repository State And Documentation Consistency Sweep

Context: Rapid RB-053 through RB-061 implementation changed domain, prediction, export, test, and operations behavior faster than the docs/backlog could stay aligned.

Impact: Stale docs can mislead future agents about implemented vs deferred workflows and can hide the next hardening priorities.

Resolution: RB-062 reconciles current-state, architecture, Prisma, workflow, storage, testing, deployment, known-gaps, and backlog documentation after RB-061.

Affected modules: `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `docs/00-overview`, `docs/workflows`, `docs/03-features`, `docs/04-server`, `docs/06-data`, `docs/src/*`, `docs/known-gaps.md`, and tickets under `tickets/2026-05-20`.

Owner: Codex.

Priority: Resolved by RB-062.

## RB-063 - Project Operations UX Split

Context: Before RB-063, Project Overview hosted metadata, prediction batch import, training export, prediction-analysis export, task navigation, and image navigation.

Impact: The overview is becoming too dense for repeated desktop work and smaller iPad screens.

Resolution: RB-063 splits project operations into route-addressable pages: `/app/projects/[projectId]` for status/actions, `/exports` for training and prediction-analysis exports, and `/prediction-imports` for prediction batch imports.

Affected modules: `src/app/(workspace)/app/projects/[projectId]`, `src/features/projects`, route docs, and Playwright smoke paths.

Owner: Codex.

Priority: Resolved by RB-063.

## RB-064 - Auth, RBAC, And Audit Hardening

Context: Before RB-064, RBAC was functional but scattered, the login page exposed seed credentials in development shape, and audit coverage was useful but incomplete.

Impact: Customer-facing trials need clearer permission policy, safer login behavior, attribution consistency, and reduced policy drift.

Resolution: RB-064 adds central server/domain permission helpers, hides shared demo credentials outside dev/explicit opt-in, sanitizes login redirects, persists hashed login throttling, adds same-origin mutation protection, throttles session last-seen writes, removes token-bearing session logs, and expands auth/project/metadata/review/provenance audit coverage.

Affected modules: `src/server/auth`, `src/server/domain/*`, `src/app/api/**`, `src/app/(public)/login`, tests, and auth/security docs.

Owner: Unassigned.

Priority: Resolved by RB-064.

## RB-065 - Batch Job Runner Hardening

Context: RB-061 batch imports were processed by explicit UI/API/script calls without a worker-oriented due-batch endpoint, lease/heartbeat model, stale `PROCESSING` recovery, or clear processor identity.

Impact: A crashed or interrupted trial import could leave work stuck until manual intervention, and operational attribution for processing needed hardening.

Resolution: RB-065 implements a single-host PostgreSQL lease model for prediction-import batch items, adds `processorId`, `processorRunId`, `leaseExpiresAt`, and `lastHeartbeatAt`, recovers stale `PROCESSING` items to `RETRY_PENDING` or `FAILED`, adds `POST /api/prediction-import-batches/process-due`, hardens `scripts/process-prediction-import-batch.mjs`, and documents an optional Docker Compose `worker` profile.

Affected modules: `src/server/domain/predictionImportBatches.ts`, `scripts/process-prediction-import-batch.mjs`, `deploy/docker-compose.trial.yml`, operations docs, and integration tests.

Owner: Codex.

Priority: Resolved by RB-065.

## RB-066 - Batch And Staging Storage Retention Cleanup

Context: Batch ZIP imports, staged prediction source files, presigned compatibility uploads, and failed object/database writes can leave private objects behind.

Impact: Local MinIO storage can grow without bounds and operators lack a documented/manual cleanup path for stale staged or orphaned objects.

Resolution: Implemented by RB-066 optimized ticket and hardened by RB-114. The app now has admin-only dry-run/execute storage cleanup via `POST /api/storage-cleanup` and `npm run storage:cleanup`, retention configuration, batch item staging purge markers, S3 prefix listing/deletion helpers, protected-object checks for raw images/artifact versions/derived crops/exports, presigned orphan handling for image/mask compatibility prefixes, additive storage/DB consistency reporting, hard-drift reporting for missing protected references and completed export checksum/size mismatch, and cleanup audit events.

Remaining follow-up: Cleanup UI/dashboard, committed-artifact retention governance, export package retention policy, object replication/HA, provider lifecycle rules, and outbox/staging redesign remain deferred.

Affected modules: `src/server/domain/storageCleanup.ts`, `src/app/api/storage-cleanup`, `scripts/storage-cleanup.mjs`, `src/server/storage/s3.ts`, `src/server/domain/predictionImportBatches.ts`, image/mask presign route docs, export job docs, operations docs, and tests.

Owner: Codex.

Priority: Resolved by RB-066.

## RB-067 - Prediction QA Metrics And Evaluation Preparation

Context: RB-060 prediction-analysis exports package predictions and references but do not compute Dice, IoU, confusion matrices, or other QA metrics.

Impact: Model-evaluation workflows still require external scripts and cannot yet provide in-app/offline metrics from exported proposals and approved references.

Resolution: Implemented by RB-067 optimized ticket. Prediction-analysis exports now embed `sapen-annotate-prediction-qa-metrics-v1` item metrics or stable not-computed reasons, compute semantic/support prediction-vs-approved-reference metrics in TypeScript, store summary metadata for export responses, and keep RB-053 training exports prediction-free and `qaMetrics`-free.

Remaining follow-up: Slice-classification QA metrics, dashboards, model-to-model reports, advanced filters, and async large analysis jobs remain deferred.

Affected modules: `src/server/domain/predictionAnalysisMetrics.ts`, `src/server/domain/predictionAnalysisExports.ts`, `src/features/projects/ProjectExportPanel.tsx`, docs under `docs/06-data`, and tests.

Owner: Codex.

Priority: Resolved by RB-067.

## RB-068 - Editor Decomposition

Context: `src/features/editor/EditorClient.tsx` owns drawing tools, semantic/support modes, review controls, slice classification, assisted correction, save state, overlays, and task context.

Impact: The editor works, but future changes will be risky if the component remains a large multi-concern implementation.

Resolution: Implemented by RB-068 optimized ticket. Editor shared types/API path builders/formatters/pointer helpers were extracted, and toolbar, canvas stack, review, slice-classification, and assisted-correction panels were split out of `EditorClient.tsx` while preserving behavior and E2E coverage.

Remaining follow-up: Deeper canvas interaction hooks, save-state hooks, advanced iPad gestures, multi-slice/multi-object editing, and performance tuning remain deferred.

Affected modules: `src/features/editor`, editor docs, and E2E/unit tests.

Owner: Codex.

Priority: Resolved by RB-068.

## RB-069 - Customer Trial Deployment, Handoff Hygiene, And iPad Safari Gate

Context: The repo has a Compose trial baseline, but real customer deployment, iPad Safari validation, handoff ZIP hygiene, legacy storage helper cleanup, and defensive download filename handling still need a focused readiness pass.

Impact: Customer or contractor handoffs can accidentally include local artifacts, iPad behavior remains unverified until deployment/device access exists, and small storage/header hygiene gaps remain before a trial.

Resolution: Implemented by RB-069 optimized ticket. The repo now has `npm run handoff:archive`, a generated handoff manifest, clean-worktree enforcement by default, safe `Content-Disposition` filename helpers, a dedicated trial deployment runbook, a customer-trial readiness summary, a real iPad Safari gate checklist, and the legacy `src/server/storage.ts` helper was removed.

Remaining follow-up: Execute the real Strato/customer deployment, run the real iPad Safari gate against the deployed URL, and add production monitoring/HA only if the trial grows beyond the current single-host model.

Affected modules: `deploy`, `docs/04-server`, `docs/operations`, `scripts/create-handoff-archive.mjs`, `src/server/http/contentDisposition.ts`, asset download routes, trial smoke docs, and ticket/runbook docs.

Owner: Codex.

Priority: Resolved by RB-069.

## RB-076 - Customer Trial Deployment Dry Run

Context: RB-069 prepared the runbook, but the trial deployment process still needed execution evidence before customer access.

Impact: Without a dry run, trial setup could fail on Compose build, migrations, seed/user setup, Caddy routing, backups, or operational commands only after customer deployment started.

Resolution: RB-076 completed a local isolated Compose dry run with `caddy`, `app`, PostgreSQL, MinIO, and the optional prediction-import worker profile. It added a safe `trial:bootstrap` path, verified named users, health/readiness, desktop browser smoke, large-mask upload, worker no-op processing, storage cleanup dry-run, PostgreSQL/MinIO backup/restore, and Caddy backup commands.

Remaining follow-up: Real Strato HTTPS deployment and real iPad Safari gate remain pending. The Docker/Prisma OpenSSL warning found during the dry run is resolved by RB-084.

Affected modules: `deploy`, `Dockerfile` follow-up, trial scripts, docs under `docs/04-server`, smoke docs, and tickets under `tickets/2026-05-21` and `tickets/2026-05-22`.

Owner: Codex.

Priority: Resolved by RB-076 local dry run.

## RB-084 - Docker Prisma OpenSSL Runtime Hygiene

Context: RB-076 found Prisma OpenSSL detection warnings during Docker build and `migrate deploy` inside the `node:22-bookworm-slim` trial image.

Impact: The trial image should not rely on Prisma fallback OpenSSL detection for generate, migrations, runtime scripts, or the optional worker.

Resolution: RB-084 installs the Debian `openssl` package in Docker stages that run Prisma generate and in the final runtime image used by app, migrate, and worker services. Prisma package versions and Compose topology remain unchanged.

Affected modules: `Dockerfile`, deployment-hygiene tests, and trial deployment docs.

Owner: Codex.

Priority: Resolved by RB-084.


## RB-070 - Editor Eraser Tool UX

Context: The editor supports brush and lasso drawing, and users can erase only indirectly by painting a background label.

Impact: The workflow is discoverable enough for developers but weak for repeated customer annotation work, especially on iPad-sized layouts.

Resolution: Implemented by RB-070 optimized ticket. The editor now has an explicit Eraser tool that writes semantic/support background values through the existing brush-sized pointer path and preserves undo/redo, dirty state, save/reload, and assisted-correction prediction overlay boundaries.

Affected modules: `src/features/editor`, `src/mask`, editor smoke docs, and editor tests.

Owner: Codex.

Priority: Resolved by RB-070.

## RB-071 - Architecture / Docs / Backlog Consistency Hotfix

Context: The 2026-05-21 deep review found stale top-level architecture/backlog statements after RB-064 through RB-069.

Impact: Stale entry-point docs can mislead future agents or contributors and reopen already-solved cleanup work.

Resolution: RB-071 refreshes `ARCHITECTURE.md`, current-state docs, known gaps, `docs/src/lib`, and this backlog to reflect the current trial-hardening sequence.

Affected modules: `ARCHITECTURE.md`, `docs/00-overview/current-state.md`, `docs/known-gaps.md`, `docs/src/lib/README.md`, `docs/adr/remediation-backlog.md`, and tickets under `tickets/2026-05-21`.

Owner: Codex.

Priority: Resolved by RB-071.

## RB-072 - Route-Level API Auth/Error Contract Hardening

Context: Several protected API routes call authentication or project-role helpers before structured route-level error handling.

Impact: Customer-facing XHR failures may become inconsistent generic errors or redirects instead of stable JSON `401`/`403`/project-access responses.

Resolution: RB-072 adds shared flat JSON API error helpers, returns JSON `401 UNAUTHENTICATED` for unauthenticated `/api/**` requests, applies route-level handling to representative project/image/review/export/prediction/batch/correction/cleanup routes, and adds unit plus browser/API contract coverage.

Remaining follow-up: Some lower-risk compatibility routes still return older direct JSON error payloads; broader cleanup can be handled incrementally when those routes are touched.

Affected modules: `src/app/api`, `src/proxy.ts`, `src/server/http/apiErrors.ts`, route/API tests, and API docs.

Owner: Codex.

Priority: Resolved by RB-072.

## RB-073 - Trial Deployment Secret & Build-Context Hygiene

Context: The trial Docker build context can include generated artifacts, and the MinIO init command currently risks rendering credentials into Compose command output.

Impact: Customer-trial handoff/deployment could expose unnecessary local artifacts or operational secrets.

Resolution: Implemented by RB-073 optimized ticket. `.dockerignore` now excludes generated/private/local artifacts, `deploy/minio-init.sh` initializes the private MinIO bucket without embedding credentials in the Compose command string, trial docs explain real-env/config-output handling, and static tests cover the deployment hygiene contract.

Remaining follow-up: External secret management, HA, production monitoring, and real Strato deployment rehearsal remain deferred to later trial/deployment tickets.

Affected modules: `.dockerignore`, `deploy/docker-compose.trial.yml`, `deploy/minio-init.sh`, deployment docs, and Compose config validation.

Owner: Codex.

Priority: Resolved by RB-073.

## RB-074 - Client API Wrapper / Presign Compatibility Cleanup

Context: `src/lib` still documents and exposes older presign/commit browser helpers while the current UI uses app-mediated upload/read routes.

Impact: Future code may accidentally reintroduce direct-storage assumptions or depend on stale fields such as browser-visible storage keys.

Resolution: Implemented by RB-074 optimized ticket. `src/lib/projectsClient.ts` and `src/lib/imagesApi.ts` now expose app-mediated browser helpers only, latest-mask helper types no longer include private keys, stale presign/commit helper exports were removed, and tests lock the client helper storage contract.

Follow-up status: RB-105 later disabled the server presign/commit compatibility routes by default. Future direct-upload compatibility should be tracked as a new staging-key design ticket if it is needed.

Affected modules: `src/lib`, compatibility presign routes, API/storage docs, and any wrapper tests retained by the slice.

Owner: Codex.

Priority: Resolved by RB-074.

## RB-075 - Dependency Audit / Prisma Version Policy

Context: `npm audit --json` still reports the known moderate Prisma CLI advisory chain.

Impact: The advisory may be acceptable for a trial if documented, but the current risk decision should not remain ambiguous.

Resolution: RB-075 applies a targeted dependency policy: `prisma`, `@prisma/client`, and `@prisma/adapter-pg` are aligned on 7.8.x; Prisma CLI's transitive `@hono/node-server` is overridden to `1.19.14`; `npm audit --json` reports 0 vulnerabilities; and the decision is documented in `docs/00-overview/dependency-audit.md`.

Remaining follow-up: Revisit the override during routine dependency maintenance or when Prisma publishes a release that no longer pulls a vulnerable `@hono/node-server` version.

Affected modules: `package.json`, `package-lock.json`, Prisma generated client workflow, and dependency docs/backlog.

Owner: Codex.

Priority: Resolved by RB-075.

## RB-080 - Editor Mask Upload Byte-Length Hotfix

Context: A full-resolution 6000x4000 image exposed a semantic mask save failure with `MASK_BYTE_LENGTH_MISMATCH`. The server-side rejection was correct because raw mask upload bodies must equal `width * height` bytes.

Impact: Large customer images could fail to save from the editor if client payload construction, readiness, or save races produced a body that did not match the target image dimensions.

Resolution: RB-080 adds an exact-byte editor upload helper, client-side byte-length validation, raw `Uint8Array` request bodies, diagnostic-only `x-mask-byte-length`, editor readiness gating, save-generation stale response protection, safe server audit diagnostics, and focused 6000x4000 browser coverage.

Remaining follow-up: If real iPad Safari or customer hardware cannot reliably edit full-resolution masks, create a separate ticket for tiled masks, downscaled working masks, patch/sparse uploads, or memory profiling. Those are intentionally out of scope for RB-080.

Affected modules: `src/features/editor`, `src/server/uploads`, mask upload routes, assisted-correction save domain, mask-format docs, smoke docs, and editor/e2e tests.

Owner: Codex.

Priority: Resolved by RB-080.

## RB-081 - Mask Upload Byte-Length Follow-up Hotfix

Context: Manual browser testing still saw `MASK_BYTE_LENGTH_MISMATCH` after RB-080. Audit logs showed the client declared 24,000,000 bytes for a 6000x4000 mask, while the server received about 10.4 MB, matching the Next.js proxy default body limit.

Impact: Full-resolution trial masks could be truncated before reaching route handlers even when the browser constructed the correct raw payload.

Resolution: RB-081 configures `experimental.proxyClientMaxBodySize` via `NEXT_PROXY_CLIENT_MAX_BODY_SIZE`, default `120mb`; adds a shared raw mask request reader for semantic, support, and assisted-correction save paths; preserves strict actual-body byte validation; adds safe diagnostics; and documents the trial full-resolution policy.

Remaining follow-up: Real iPad Safari still needs device validation at large sizes. Images above `8000x6000` require a future tiled, downscaled, sparse, or patch-upload workflow.

Affected modules: `next.config.ts`, deployment config, `src/server/uploads`, mask save routes, image upload validation/UI, editor UI, docs, and tests.

Owner: Codex.

Priority: Resolved by RB-081.

## RB-083 - Edit Session / Soft Lock / Multi-Tab Warning

Context: Trial users may open the same large image in multiple browser tabs. Ground-truth saves are versioned and append-only, but multiple tabs increase browser memory pressure and can confuse annotators about which draft is current.

Impact: This is most risky on iPad or other memory-constrained devices and for images near the `8000x6000` trial upper bound.

Proposed next step: Add an edit-session signal or local multi-tab warning for the same image, without hard-blocking normal browser behavior. Consider server-visible soft locks only after real trial feedback.

Affected modules: editor page, editor client state, browser storage/session signaling, audit/docs.

Owner: Unassigned.

Priority: Deferred in `tickets/deferred/RB-083-editor-edit-session-soft-lock-multitab-warning.md`.

## RB-077 - Real iPad Safari Trial Gate Execution

Context: iPad viewport prep and manual checklists exist, but real iPad Safari validation has not been executed against a deployed app.

Impact: Canvas scaling, Apple Pencil behavior, file uploads, rotation, and Home Screen behavior can fail only on the physical device/browser.

Proposed next step: Run the manual iPad Safari gate after deployment and convert any failures into focused follow-up tickets. The execution ticket is deferred at `tickets/deferred/RB-077-B-real-ipad-safari-trial-gate-execution.md`; RB-077 completed gate preparation and tracking only.

Affected modules: editor UI, iPad smoke docs, customer-trial readiness docs, and any defect tickets created from the gate.

Owner: Unassigned.

Priority: Deferred until deployed URL and device access exist.

## RB-078 - Post-Trial Findings / Triage

Context: After real customer-trial usage, the backlog should be reordered based on evidence instead of speculative feature planning.

Impact: Without a triage pass, larger features such as review dashboards, audit UI, multi-slice support, and async exports may be prioritized before actual customer blockers.

Proposed next step: Review trial feedback, logs, smoke results, and operator notes; split findings into bugs, trial blockers, UX improvements, and larger roadmap tickets. The triage ticket is deferred at `tickets/deferred/RB-078-post-trial-findings-triage.md`.

Affected modules: docs/backlog, tickets, and any areas implicated by customer findings.

Owner: Unassigned.

Priority: Deferred until real customer/operator trial findings exist.

## DESIGN-005 - Shared SaPen Shell Package Extraction

Context: SaPen Annotate mirrors the SaPen Core top bar locally, but it does not currently depend on Core's shared `@sapen/ui` and `@sapen/assets` packages.

Impact: Product-family shell changes can drift between SaPen Core, SaPen Refine, and SaPen Annotate if the shared shell components remain duplicated.

Proposed next step: Define a shared shell/assets package contract for `AppTopBar`, top-bar utility buttons, logo assets, and account menu behavior once both apps can consume the same workspace package without cross-repo runtime imports.

Affected modules: `src/components/shell`, `src/design`, package/dependency configuration, and future shared SaPen UI/assets packages.

Owner: Unassigned.

Priority: Deferred design-system consolidation.

## DESIGN-008-A - Per-User Editor Image Last-Opened Ordering

Context: DESIGN-008 makes the annotation editor sidebar image-scoped and pins the active image first, but the app does not persist per-user editor image open/access timestamps.

Impact: The `IMAGES` sidebar can only approximate "recently opened" ordering with active-image pinning plus `ImageAsset.updatedAt` / `createdAt` fallback. Images with recent annotation work sort reasonably, but pure view/open recency is not represented.

Proposed next step: Add a lightweight per-user image editor access table or session activity field, update it from editor route entrypoints, and sort the editor sidebar by that timestamp before falling back to image update/create time.

Affected modules: authenticated editor routes, app shell image context, project images API, Prisma schema, and shell/sidebar tests.

Owner: Unassigned.

Priority: P3 UX follow-up after DESIGN-008.

## DESIGN-010-A - Review-Scoped BBox Submission Semantics

Context: DESIGN-010 removes misleading BBox-level confirmation controls from the tool toolbar, but the persisted `/api/images/[imageId]/slice-bboxes/confirm` workflow still allows editable annotation roles to prepare/open slices. The current RBAC model distinguishes `annotation:submitOwnWork` from `review:approve`, but the BBox stage itself does not yet model separate labeler submission and owner/QA confirmation semantics.

Impact: The UI no longer presents BBoxes as independently approved artifacts, but future reviewer workflows may need clearer handoff language and server-side state if BBox preparation becomes part of a broader submission/review gate.

Proposed next step: Design a review-scoped annotation submission model that separates labeler submit actions from owner/QA confirmation/approval, then decide whether image-level BBox preparation should remain a planning gate or participate in that review state.

Affected modules: `src/server/auth/policies.ts`, BBox workflow APIs, editor workflow UI, review APIs, docs, and E2E tests.

Owner: Unassigned.

Priority: P3 workflow semantics follow-up after DESIGN-010.
