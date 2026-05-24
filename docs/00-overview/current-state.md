# Current State

## Purpose

This page records the repository state after the RB-049 through RB-069 annotation-domain, workflow, export, artifact-integrity, provenance, prediction-import, correction, prediction-analysis, batch-import, project-operations routing, auth/RBAC/audit, batch-runner hardening, storage-cleanup, prediction QA metrics, editor decomposition, customer-trial handoff, trial-hardening, RB-076 local deployment dry-run, RB-077 iPad deferred-tracking, RB-085 through RB-098 crop-workflow slices, RB-104 legacy full-image editor removal, and the RB-105 through RB-118 review-hardening sequence.

## Important Files

- `package.json` - root scripts for Prisma generation, lint, typecheck, build, Vitest, Playwright E2E, and design-hardcoding checks.
- `prisma/schema.prisma` - current annotation-domain persisted model.
- `src/app/(public)/login/page.tsx` and `src/app/(public)/login/LoginForm.tsx` - public login route.
- `src/app/(workspace)/app/**` - protected App Router workspace URLs.
- `src/app/not-found.tsx`, `src/app/(workspace)/app/not-found.tsx`, and `src/app/(workspace)/app/[...missing]/page.tsx` - SaPen Annotate branded not-found fallbacks for stale or unknown page URLs.
- `src/app/api/**` - current auth, project, image, mask, health, and readiness route handlers.
- `src/features/projects`, `src/features/images`, and `src/features/editor` - feature-owned workflow composition.
- `src/server/auth`, `src/server/runtime`, `src/server/storage`, `src/server/uploads`, and `src/server/domain/storageCleanup.ts` - server-only auth, config, storage, upload validation, and temporary cleanup helpers.
- `src/server/http/contentDisposition.ts` - shared safe `Content-Disposition` header helper for app-mediated image/export downloads.
- `scripts/create-handoff-archive.mjs` - reproducible clean-worktree handoff ZIP command.
- `scripts/trial-bootstrap.mjs` and `scripts/create-trial-user.mjs` - customer-trial bootstrap and named-user setup commands.
- `scripts/operator-actor-context.mjs` - RB-116-A operator/system actor-context helper for trial bootstrap scripts.
- `src/mask` - current label constants, mask buffers, serialization, patching, and overlay rendering.
- `src/components/shell` and `src/design` - reusable workspace shell, UI primitives, design tokens, and editor canvas constants.
- `tests/e2e/desktop-browser-smoke.spec.ts` and `tests/e2e/ipad-viewport-prep.spec.ts` - current browser smoke coverage.
- `tests/unit/docs-link-governance.test.ts` - RB-119 local Markdown link/index guard.
- `tickets/deferred/` - deferred manual gates and backlog tickets that are not actionable until their trigger conditions exist.

## Current Baseline

The current validation baseline is green:

- `npm run db:rebuild`
- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run test:e2e`
- `npm run check:docs-links`
- `npm run check:design-hardcoding`
- `npm run handoff:archive -- --dry-run`

`npm run check:docs-links` checks governed local Markdown links in `AGENTS.md`, `ARCHITECTURE.md`, `docs/**/*.md`, and `tickets/2026-05-23/README.md`; links are resolved relative to the source file.

## Current Application Model

- Local login uses `src/app/api/auth/login/route.ts`, `src/server/auth/session.ts`, and the `User`/`Session` tables. RB-064 adds sanitized app-relative redirects, hidden demo credentials outside dev/explicit opt-in, hashed `AuthLoginThrottle` buckets, and throttled session `lastSeenAt` writes.
- Project membership is the current access boundary through `AnnotationProject` and `AnnotationProjectMember`; `src/server/auth/policies.ts` defines the central project/global role policy used by protected project/image/domain workflows.
- Image upload uses app-mediated trial paths in `src/app/api/projects/[projectId]/images/upload/route.ts`; legacy presign/commit routes remain present but disabled with `PRESIGNED_UPLOADS_DISABLED`. Current raw image writes validate PNG/JPEG bytes, checksum, dimensions, size, and object metadata before persisting `ImageAsset`. RB-118 documents that this is authenticated-trial integrity validation, not public upload malware/content-safety scanning.
- Browser image reads use app-mediated routes such as `src/app/api/images/[imageId]/asset/route.ts` and `src/app/api/images/[imageId]/view/route.ts`.
- App-mediated image/export download routes use shared `Content-Disposition` filename sanitization with ASCII fallback and UTF-8 `filename*`.
- The legacy full-image editor route was removed by RB-104. `src/features/editor/EditorClient.tsx` remains as a shared source-image canvas for the crop BBox stage and assisted-correction route.
- Source-image BBox slice proposals use the crop BBox stage plus `src/app/api/images/[imageId]/slice-bboxes/route.ts`, `src/app/api/slice-bboxes/[bboxVersionId]/route.ts`, and `src/server/domain/sliceBboxes.ts`. Proposal versions are append-only `SliceBoundingBoxVersion` rows in `SOURCE_IMAGE_PIXEL`; they are not support masks or export-ready ground truth.
- The crop workflow BBox stage uses `/app/projects/[projectId]/images/[imageId]/crop/bboxes`, `src/features/editor/ImageCropBBoxesPage.tsx`, `src/server/domain/imageCropWorkflow.ts`, and `POST /api/images/[imageId]/slice-bboxes/confirm` to persist image-level BBox set confirmation without treating BBoxes as ground-truth approval.
- The crop workflow slice navigator uses `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]`, `src/features/editor/ImageCropSliceNavigatorClient.tsx`, `src/features/editor/CropEditorSliceNavigatorRailClient.tsx`, and `src/server/domain/cropSliceNavigator.ts` to show the source image with BBox overlays and per-slice crop/support/semantic/classification/readiness badges. RB-096 redirects selected current crops to `/crop/slices/[sliceInstanceId]/crops/[cropId]`, a mode-aware workbench with crop preview, status, next action guidance, and embedded whole-image navigation. RB-097 prevents accidental Sap/Heartwood/Copper family mixing through active-family detection, explicit reset saves, and readiness blockers for conflicts. RB-101 embeds the navigator as the right rail of crop support and semantic editors.
- Derived slice crops use `src/app/api/images/[imageId]/slice-crops/route.ts`, `src/app/api/slice-bboxes/[bboxVersionId]/crop/route.ts`, `src/app/api/slice-crops/[cropId]/asset/route.ts`, and `src/server/domain/sliceCrops.ts`. Crops are private PNG derived artifacts in `CROP_PIXEL`; they are app-mediated for browser preview and are not support geometry.
- Crop support masks use `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support`, `src/app/api/slice-crops/[cropId]/support-mask/*`, and `src/server/domain/cropSupportMasks.ts`. They are crop-sized `SLICE_SUPPORT_MASK` artifact versions in `CROP_PIXEL` linked to the source image, slice instance, and derived crop.
- Stale metadata image URLs and project/image mismatches render a project-aware missing-resource soft landing through `src/components/shell/AppMissingResource.tsx`; old full-image editor URLs use the normal workspace not-found fallback.
- Mask save uses app-mediated upload through `src/app/api/images/[imageId]/mask/upload/route.ts`; legacy presign/commit routes remain present but disabled with `PRESIGNED_UPLOADS_DISABLED`. Semantic and support masks are validated as image-sized `u8raw-v1` byte arrays before version rows are created.
- Browser-side helpers in `src/lib/projectsClient.ts` and `src/lib/imagesApi.ts` follow the app-mediated upload/read contract and do not expose private storage keys or presigned upload internals.
- Latest mask reload uses `src/app/api/images/[imageId]/mask/latest/route.ts` and app-mediated version assets.
- Prediction mask import uses `src/app/api/prediction-runs/[predictionRunId]/predictions/route.ts` to validate and store private `PREDICTION_MASK` proposal artifacts linked to `PredictionArtifactProvenance`.
- Project operations use route-addressable pages: `/app/projects/[projectId]` for status/actions, `/images` for image work, `/tasks` for correction queues, `/exports` for training and prediction-analysis exports, and `/prediction-imports` for prediction batch imports.
- Batch prediction import uses `src/app/api/prediction-runs/[predictionRunId]/batch-imports/route.ts`, `src/app/api/prediction-import-batches/*`, `src/server/domain/predictionImportBatches.ts`, `src/server/domain/predictionImportBatchLeases.ts`, and `/app/projects/[projectId]/prediction-imports` to create ZIP-backed DB jobs/items and process items through the RB-057 import service. RB-065 adds bounded process-due worker processing, processor identity, and stale `PROCESSING` lease recovery for prediction-import items only.
- Storage cleanup uses `src/app/api/storage-cleanup/route.ts`, `src/server/domain/storageCleanup.ts`, and `scripts/storage-cleanup.mjs` to dry-run or execute deletion of temporary batch staging objects and identifiable abandoned presigned uploads. It requires global `ADMIN`, protects committed raw images, artifact versions, prediction artifacts, and export packages, and reports RB-114 storage/DB consistency findings without breaking the existing cleanup response fields.
- Prediction-analysis QA metrics use `src/server/domain/predictionAnalysisMetrics.ts` and `src/server/domain/predictionAnalysisExports.ts` to compare semantic/support prediction artifacts against approved human references and embed metric or not-computed payloads in the QA manifest.
- Training, crop-training, and prediction-analysis export package creation verifies object bytes against persisted checksum and size before ZIP insertion.
- High-cost mutation families are rate limited through the RB-111 single-host DB-backed limiter; this is an operational trial guard, not a distributed quota/billing system.
- Trial bootstrap and trial-user scripts write RB-115-A-style actor context after RB-116-A. RB-115-B and RB-115-C remain follow-ups for broader unattended worker and external/Core handoff provenance.
- Handoff packaging uses `npm run handoff:archive` to create a ZIP from tracked files, include `handoff-manifest.json`, exclude local/private artifacts, and reject dirty worktrees unless `--allow-dirty` is explicit.
- RB-076 verified the current single-host Compose trial path locally through [../04-server/trial-deployment-dry-run-2026-05-22.md](../04-server/trial-deployment-dry-run-2026-05-22.md). Real Strato HTTPS and iPad Safari validation remain separate gates.

## Current Data Model

- `AnnotationProject` is the standalone collaboration container and can reference an active label schema version.
- `ImageAsset` stores a raw object key, verified file metadata, checksum/dimensions, validation status, uploader, and metadata relations.
- `AnnotationArtifact` groups semantic/support/instance/prediction/derived artifacts by image, kind, and scope key.
- `AnnotationArtifactVersion` is append-only per artifact and stores artifact key, size, dimensions, checksum, format, label schema version, review state, provenance, creator, and timestamp.
- Crop support-mask artifact versions additionally store nullable crop and slice lineage through `derivedCropId` and `sliceInstanceId`.
- `SliceBoundingBoxVersion` is append-only per BBox proposal slice instance and stores source-image integer geometry, active/deleted status, provenance, creator, and timestamp.
- `ImageCropWorkflowState` stores one image-level BBox set workflow row per image, confirmed active BBox version snapshots, confirmation attribution, and `NEEDS_UPDATE` state when confirmed BBoxes change.
- `DerivedSliceCrop` is append-only per slice instance and stores source-image lineage, BBox version, crop rectangle, requested/applied padding, clipping state, transform metadata, private PNG storage metadata, creator, and timestamp.
- `AuditLog` records upload, mask/support-mask, auth, project/metadata, review, export, prediction, correction, batch-processing, and storage-cleanup events. There is no admin audit UI yet.

## Invariants And Constraints

- URL-first workspace routes must remain stable while domain implementation evolves.
- Raw image objects should be treated as immutable after commit.
- Mask saves should append versions instead of overwriting previous versions.
- BBox proposal replacement/deletion should append versions instead of overwriting previous proposal geometry.
- Derived crop generation should append versions instead of overwriting previous crop bytes or metadata.
- Writes must be tied to an authenticated user or an explicit future system actor.
- Development data may be destroyed during schema work; RB-049 replaces the baseline migration and uses `npm run db:rebuild`.

## Known Gaps

- The current schema models label schemas, annotation tasks/sessions, acquisition/sample metadata structures, review decisions, slice instances/classifications, BBox proposal versions, image-level BBox workflow state, derived crop versions, crop semantic/support lineage, semantic-derived classification provenance, export records, RB-056/RB-057 prediction provenance/import records, RB-058/RB-059 correction workflows, RB-060/RB-067 prediction-analysis exports and QA metrics, RB-061 batch prediction import jobs, RB-065 batch item processor/lease fields, and RB-066 batch staging purge markers. RB-063 adds route-addressable project operations pages without schema changes.
- Copper masks are semantic material annotations; RB-051 adds the first separate support-mask workflow for one default slice per image.
- RB-086 adds rough BBox proposals for candidate slices, RB-087 adds derived crop generation, RB-088 adds crop support-mask editing, RB-089 adds crop semantic annotation, RB-090 adds auto classification suggestions with manual override provenance, RB-091 adds crop training export, RB-092 adds shared crop readiness/review integration, and RB-094 adds persisted BBox set confirmation. Source-image-space crop-mask reprojection remains deferred.
- Upload and auth hardening now cover the current raw image, semantic mask, support mask, prediction import, export, login, and cross-site mutation paths. RB-065 adds an optional single-host Compose worker for batch prediction imports. RB-066 adds admin-only temporary storage cleanup without a UI. RB-067 adds export-time QA metrics without a dashboard. RB-111 adds single-host high-cost write limits, RB-112 adds single-host async export jobs for trial-sized packages, RB-114 adds storage/DB consistency reporting, RB-115 through RB-116-A harden actor/audit governance, and RB-118 documents upload content-safety prerequisites. Implemented upload quarantine/scanning/normalization, streaming/distributed export packaging, production-scale queue infrastructure/system actors, committed-artifact retention, cleanup dashboards, and metrics dashboards remain deferred.
- Real iPad Safari validation remains deferred until deployment/device access is available; [../07-testing/manual-smoke-ipad-safari-gate.md](../07-testing/manual-smoke-ipad-safari-gate.md) is the ready-to-run gate, `tickets/deferred/RB-077-B-real-ipad-safari-trial-gate-execution.md` tracks the original manual gate, and `../../tickets/2026-05-23/RB-113-real-ipad-safari-trial-gate-execution-optimized-post-RB112.md` tracks the active post-RB-112 sprint gate. Do not mark it complete without physical iPad Safari evidence.
- The 2026-05-21 trial-hardening sequence is documented in `tickets/2026-05-21`: RB-070 adds editor eraser UX, RB-071 covers this docs/backlog consistency hotfix, RB-072 covers route-level API auth/error contracts, RB-073 covers trial deployment hygiene, RB-074 cleans up stale client API wrappers, RB-075 covers Prisma audit/version policy, RB-082 covers missing-resource/not-found page UX, RB-076 covers the local deployment dry run, RB-077 completes iPad gate preparation/deferred tracking, and RB-077-B/RB-078 now live in `tickets/deferred/` until real device/trial evidence exists.

## Related Tickets / Docs

- [baseline-checks.md](baseline-checks.md)
- [../06-data/prisma.md](../06-data/prisma.md)
- [../06-data/mask-format.md](../06-data/mask-format.md)
- [../testing/README.md](../testing/README.md)
