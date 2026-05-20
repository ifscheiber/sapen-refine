# Remediation Backlog

Deferred work discovered during repository hygiene should be recorded here instead of expanding active ticket scope.

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

Proposed next step: Add a focused editor UX ticket after domain model cleanup, covering responsive layout, touch/pointer interactions, canvas scaling, and undo/save behavior.

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

Proposed next step: Re-check Prisma 7.x releases in a dedicated dependency ticket. Do not apply npm's current `--force` recommendation without review because it would install `prisma@6.19.3` and npm marks that as semver-major.

Affected modules: `package.json`, `package-lock.json`, Prisma CLI dependency chain.

Owner: Unassigned.

Priority: P2.

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

Resolution: Implemented by RB-053 optimized ticket. Project owners can create synchronous training exports from the project overview. The export workflow records an `ExportBatch`, exact `ExportItem` references, a manifest checksum, package checksum/size metadata, warnings, and actor attribution. Downloads are served through app routes without exposing private MinIO URLs.

Remaining follow-up: Advanced export filters, export history/dashboard UI, QA export policy, and job queue/large dataset handling remain deferred.

Affected modules: `src/server/domain/exports.ts`, `src/app/api/projects/[projectId]/export/readiness`, `src/app/api/projects/[projectId]/exports`, `src/app/api/exports/[exportId]`, `src/features/projects/ProjectExportPanel.tsx`, `tests/integration/export-workflow.test.ts`, `tests/e2e/desktop-browser-smoke.spec.ts`, and docs under `docs/03-features`, `docs/04-server`, `docs/06-data`, and `docs/testing`.

Owner: Codex.

Priority: Resolved.

## RB-054 - Model Preprediction And Active-Learning Design

Context: RB-048 reserves task priority, uncertainty/confidence, model source, and task reason concepts for future model-assisted workflows.

Impact: Prediction-assisted annotation could compromise ground-truth integrity if model proposals are not modeled separately.

Resolution: Implemented by RB-054 optimized ticket. Prediction artifacts are documented as proposals only, not ground truth. Future human corrections must create separate human versions, active-learning queue ordering is documented, and RB-053 export remains approved-human-only.

Remaining follow-up: RB-057 through RB-061 cover prediction import, active-learning queues, assisted correction editor workflow, prediction-analysis export, and batch/background imports.

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

Remaining follow-up: RB-057 through RB-061 cover prediction file import, task queues/UI, assisted correction editor workflow, prediction-analysis export mode, and batch/background import jobs.

Affected modules: `prisma/schema.prisma`, `src/server/domain/predictionProvenance.ts`, `src/app/api/model-runs/*`, `src/app/api/projects/[projectId]/prediction-runs/route.ts`, `src/app/api/prediction-runs/[predictionRunId]/route.ts`, tests and docs under `docs/06-data`.

Owner: Codex.

Priority: Resolved.

## RB-057 - Prediction Import API And Storage Validation

Context: RB-054 defines prediction artifacts as proposals, and RB-055 hardens the current object validation helpers.

Impact: The app cannot safely ingest model-generated prediction artifacts yet.

Proposed next step: Implement `tickets/2026-05-19/RB-057-prediction-import-api-storage-validation.md`.

Affected modules: future prediction import routes/services, `src/server/storage`, `src/server/uploads`, `prisma/schema.prisma`, docs under `docs/06-data`.

Owner: Unassigned.

Priority: P1.

## RB-058 - Active-Learning Task Queue API And UI

Context: RB-054 defines task reasons and deterministic queue ordering, but no queue APIs or UI exist.

Impact: Annotators cannot act on model uncertainty or correction-task priority.

Proposed next step: Implement `tickets/2026-05-19/RB-058-active-learning-task-queue-api-ui.md`.

Affected modules: future task APIs, project/task UI, RBAC, docs under `docs/03-features` and `docs/06-data`.

Owner: Unassigned.

Priority: P2.

## RB-059 - Assisted Correction Editor Workflow

Context: RB-054 defines the future editor behavior for prediction overlays and human correction layers.

Impact: Prediction-backed tasks cannot be corrected in the editor without risking mutation of prediction artifacts or confusion with human ground truth.

Proposed next step: Implement `tickets/2026-05-19/RB-059-assisted-correction-editor-workflow.md`.

Affected modules: `src/features/editor`, future task route/API integrations, `src/mask`, docs under `docs/03-features`.

Owner: Unassigned.

Priority: P2.

## RB-060 - Prediction Analysis Export Mode

Context: RB-053 ground-truth exports intentionally exclude model predictions. RB-054 allows a future QA/prediction-analysis export only as a separate target.

Impact: Teams may need to inspect model predictions and confidence data without contaminating ground-truth training exports.

Proposed next step: Implement `tickets/2026-05-19/RB-060-prediction-analysis-export-mode.md`.

Affected modules: `src/server/domain/exports.ts`, future prediction provenance services, export docs and tests.

Owner: Unassigned.

Priority: P2.

## RB-061 - Batch Prediction Import And Background Jobs

Context: RB-054 identifies large prediction imports as unsuitable for long synchronous route-handler or browser requests.

Impact: Larger customer or model-evaluation datasets need retryable, attributable import bookkeeping.

Proposed next step: Implement `tickets/2026-05-19/RB-061-batch-prediction-import-background-jobs.md`.

Affected modules: future background-job infrastructure, prediction import services, operations docs.

Owner: Unassigned.

Priority: P2.
