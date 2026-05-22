# Current State

## Purpose

This page records the repository state after the RB-049 through RB-069 annotation-domain, workflow, export, artifact-integrity, provenance, prediction-import, correction, prediction-analysis, batch-import, project-operations routing, auth/RBAC/audit, batch-runner hardening, storage-cleanup, prediction QA metrics, editor decomposition, customer-trial handoff, trial-hardening, and RB-076 local deployment dry-run and RB-077 iPad deferred-tracking slices.

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
- `src/mask` - current label constants, mask buffers, serialization, patching, and overlay rendering.
- `src/components/shell` and `src/design` - reusable workspace shell, UI primitives, design tokens, and editor canvas constants.
- `tests/e2e/desktop-browser-smoke.spec.ts` and `tests/e2e/ipad-viewport-prep.spec.ts` - current browser smoke coverage.
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
- `npm run check:design-hardcoding`
- `npm run handoff:archive -- --dry-run`

There is no `check:docs-links` script in `package.json` yet.

## Current Application Model

- Local login uses `src/app/api/auth/login/route.ts`, `src/server/auth/session.ts`, and the `User`/`Session` tables. RB-064 adds sanitized app-relative redirects, hidden demo credentials outside dev/explicit opt-in, hashed `AuthLoginThrottle` buckets, and throttled session `lastSeenAt` writes.
- Project membership is the current access boundary through `AnnotationProject` and `AnnotationProjectMember`; `src/server/auth/policies.ts` defines the central project/global role policy used by protected project/image/domain workflows.
- Image upload uses app-mediated trial paths in `src/app/api/projects/[projectId]/images/upload/route.ts`; legacy presign/commit routes still exist for compatibility. Current raw image writes validate PNG/JPEG bytes, checksum, dimensions, size, and object metadata before persisting `ImageAsset`.
- Browser image reads use app-mediated routes such as `src/app/api/images/[imageId]/asset/route.ts` and `src/app/api/images/[imageId]/view/route.ts`.
- App-mediated image/export download routes use shared `Content-Disposition` filename sanitization with ASCII fallback and UTF-8 `filename*`.
- The editor route is `/app/projects/[projectId]/images/[imageId]/edit`, composed by `src/features/editor/EditImagePage.tsx` and `src/features/editor/EditorClient.tsx`.
- Stale editor/metadata image URLs and project/image mismatches render a project-aware missing-resource soft landing through `src/components/shell/AppMissingResource.tsx`; missing or unauthorized project pages use App Router `notFound()` to avoid existence leakage.
- Mask save uses app-mediated upload through `src/app/api/images/[imageId]/mask/upload/route.ts`; legacy presign/commit routes still exist as compatibility endpoints. Semantic and support masks are validated as image-sized `u8raw-v1` byte arrays before version rows are created.
- Browser-side helpers in `src/lib/projectsClient.ts` and `src/lib/imagesApi.ts` follow the app-mediated upload/read contract and do not expose private storage keys or presigned upload internals.
- Latest mask reload uses `src/app/api/images/[imageId]/mask/latest/route.ts` and app-mediated version assets.
- Prediction mask import uses `src/app/api/prediction-runs/[predictionRunId]/predictions/route.ts` to validate and store private `PREDICTION_MASK` proposal artifacts linked to `PredictionArtifactProvenance`.
- Project operations use route-addressable pages: `/app/projects/[projectId]` for status/actions, `/images` for image work, `/tasks` for correction queues, `/exports` for training and prediction-analysis exports, and `/prediction-imports` for prediction batch imports.
- Batch prediction import uses `src/app/api/prediction-runs/[predictionRunId]/batch-imports/route.ts`, `src/app/api/prediction-import-batches/*`, `src/server/domain/predictionImportBatches.ts`, `src/server/domain/predictionImportBatchLeases.ts`, and `/app/projects/[projectId]/prediction-imports` to create ZIP-backed DB jobs/items and process items through the RB-057 import service. RB-065 adds bounded process-due worker processing, processor identity, and stale `PROCESSING` lease recovery for prediction-import items only.
- Storage cleanup uses `src/app/api/storage-cleanup/route.ts`, `src/server/domain/storageCleanup.ts`, and `scripts/storage-cleanup.mjs` to dry-run or execute deletion of temporary batch staging objects and identifiable abandoned presigned uploads. It requires global `ADMIN` and protects committed raw images, artifact versions, prediction artifacts, and export packages.
- Prediction-analysis QA metrics use `src/server/domain/predictionAnalysisMetrics.ts` and `src/server/domain/predictionAnalysisExports.ts` to compare semantic/support prediction artifacts against approved human references and embed metric or not-computed payloads in the QA manifest.
- Handoff packaging uses `npm run handoff:archive` to create a ZIP from tracked files, include `handoff-manifest.json`, exclude local/private artifacts, and reject dirty worktrees unless `--allow-dirty` is explicit.
- RB-076 verified the current single-host Compose trial path locally through [../04-server/trial-deployment-dry-run-2026-05-22.md](../04-server/trial-deployment-dry-run-2026-05-22.md). Real Strato HTTPS and iPad Safari validation remain separate gates.

## Current Data Model

- `AnnotationProject` is the standalone collaboration container and can reference an active label schema version.
- `ImageAsset` stores a raw object key, verified file metadata, checksum/dimensions, validation status, uploader, and metadata relations.
- `AnnotationArtifact` groups semantic/support/instance/prediction/derived artifacts by image, kind, and scope key.
- `AnnotationArtifactVersion` is append-only per artifact and stores artifact key, size, dimensions, checksum, format, label schema version, review state, provenance, creator, and timestamp.
- `AuditLog` records upload, mask/support-mask, auth, project/metadata, review, export, prediction, correction, batch-processing, and storage-cleanup events. There is no admin audit UI yet.

## Invariants And Constraints

- URL-first workspace routes must remain stable while domain implementation evolves.
- Raw image objects should be treated as immutable after commit.
- Mask saves should append versions instead of overwriting previous versions.
- Writes must be tied to an authenticated user or an explicit future system actor.
- Development data may be destroyed during schema work; RB-049 replaces the baseline migration and uses `npm run db:rebuild`.

## Known Gaps

- The current schema models label schemas, annotation tasks/sessions, acquisition/sample metadata structures, review decisions, slice instances/classifications, export records, RB-056/RB-057 prediction provenance/import records, RB-058/RB-059 correction workflows, RB-060/RB-067 prediction-analysis exports and QA metrics, RB-061 batch prediction import jobs, RB-065 batch item processor/lease fields, and RB-066 batch staging purge markers. RB-063 adds route-addressable project operations pages without schema changes.
- Copper masks are semantic material annotations; RB-051 adds the first separate support-mask workflow for one default slice per image.
- Upload and auth hardening now cover the current raw image, semantic mask, support mask, prediction import, export, login, and cross-site mutation paths. RB-065 adds an optional single-host Compose worker for batch prediction imports. RB-066 adds admin-only temporary storage cleanup without a UI. RB-067 adds export-time QA metrics without a dashboard. Malware scanning, general API write rate limiting, large async export jobs, production-scale queue infrastructure/system actors, committed-artifact retention, cleanup dashboards, and metrics dashboards remain deferred.
- Real iPad Safari validation remains deferred until deployment/device access is available; [../07-testing/manual-smoke-ipad-safari-gate.md](../07-testing/manual-smoke-ipad-safari-gate.md) is the ready-to-run gate and `tickets/deferred/RB-077-B-real-ipad-safari-trial-gate-execution.md` tracks manual execution.
- The 2026-05-21 trial-hardening sequence is documented in `tickets/2026-05-21`: RB-070 adds editor eraser UX, RB-071 covers this docs/backlog consistency hotfix, RB-072 covers route-level API auth/error contracts, RB-073 covers trial deployment hygiene, RB-074 cleans up stale client API wrappers, RB-075 covers Prisma audit/version policy, RB-082 covers missing-resource/not-found page UX, RB-076 covers the local deployment dry run, RB-077 completes iPad gate preparation/deferred tracking, and RB-077-B/RB-078 now live in `tickets/deferred/` until real device/trial evidence exists.

## Related Tickets / Docs

- [baseline-checks.md](baseline-checks.md)
- [../06-data/prisma.md](../06-data/prisma.md)
- [../06-data/mask-format.md](../06-data/mask-format.md)
- [../testing/README.md](../testing/README.md)
