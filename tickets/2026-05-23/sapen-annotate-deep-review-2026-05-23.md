# SaPen Annotate Deep Review - 2026-05-23

## Scope

Reviewed the current `sapen-annotate` repository as a production-readiness and code-review pass. The review started from `AGENTS.md`, `ARCHITECTURE.md`, and the documentation index, then checked the implementation in `src/app`, `src/server`, `src/features`, `src/mask`, `prisma`, deployment scripts, tests, and operational docs.

This is a review report only. No production code was changed.

## Validation Baseline

Initial worktree state was clean.

Commands run:

- `git status --short` - clean.
- `npm run prisma:generate` - passed.
- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npm run build` - passed.
- `npm run test` - passed, 42 files / 222 tests.
- `npm run test:e2e` - passed, 11 Playwright tests.
- `npm run check:design-hardcoding` - passed.
- `npm audit --json` - passed, 0 vulnerabilities.
- `npm run handoff:archive -- --dry-run` - passed, 499 files, dirty: no.

## Executive Summary

The repository is in a strong customer-trial state. The core data model is no longer prototype-only: it has project membership, local auth, image metadata, label schema versions, semantic/support/instance/prediction artifact separation, append-only artifact versions, review decisions, export batches, crop workflow provenance, prediction provenance, batch import leases, and storage cleanup.

The biggest remaining production risks are not broad architecture gaps. They are concentrated around compatibility routes, concurrency, export scale, and real-device validation:

- Legacy presigned upload compatibility routes can violate raw-image and mask immutability during their remaining PUT URL lifetime.
- Many protected API routes still rely on local `try/catch` blocks after `requireUser()`, so stale-session API calls can escape the flat JSON error contract.
- Artifact and classification version numbers are allocated by reading latest version and inserting `latest + 1`, which can fail under concurrent saves.
- Training and prediction-analysis exports are synchronous in-memory ZIP builds; this is acceptable for trial data but not production-scale datasets.
- Real iPad Safari validation remains deferred even though iPad readiness is a product concern.

## Strengths

- Product boundaries are clear: SaPen Annotate is separate from SaPen Core, and prediction-assisted correction is modeled as proposal/correction provenance rather than ground truth.
- The Prisma schema is mature for the current workflow. `AnnotationArtifactVersion`, `ReviewDecision`, `ExportBatch`, `DerivedSliceCrop`, `SliceBoundingBoxVersion`, and prediction-import models encode most of the important invariants.
- Backend ownership is mostly respected. UI helpers call API routes, while persistence and workflow decisions sit in `src/server/domain`.
- Upload and mask integrity are strong on the app-mediated path: image bytes, content type, dimensions, checksums, object stat checks, mask dimensions, and support-mask values are validated server-side.
- The crop workflow is well documented and keeps BBoxes, derived crops, support masks, semantic masks, classifications, and reviews conceptually separate.
- Tests are unusually broad for this stage. Unit, integration, E2E, deployment hygiene, handoff archive, auth hardening, storage cleanup, and export-contract tests all passed in this review.
- Deployment docs and trial Compose files are coherent for a single-host customer trial.

## Findings

### P1 - Presigned compatibility uploads can mutate committed training artifacts

Evidence:

- `src/app/api/projects/[projectId]/images/presign/route.ts` returns a presigned PUT URL and final image key under `projects/${projectId}/images/...`.
- `src/app/api/projects/[projectId]/images/commit/route.ts` validates the current object and persists the same key into `ImageAsset.storageKey`.
- `src/app/api/images/[imageId]/mask/presign/route.ts` and `src/app/api/images/[imageId]/mask/commit/route.ts` use the same pattern for semantic mask artifact versions.
- `src/server/storage/s3.ts` presigns `PutObjectCommand` for the exact key. S3-compatible PUT overwrites the object at that key while the URL remains valid.
- `src/server/domain/exports.ts` packages objects with `getObjectBytes(...)` and records manifest values from DB metadata, but it does not recompute object checksums before adding bytes to the ZIP.

Impact:

After commit, a client that still holds the presigned URL can overwrite the object for up to the remaining 5-minute URL lifetime. That breaks the stated invariant that raw images are immutable after commit and can make DB checksums/manifests disagree with exported package bytes.

Recommendation:

Disable or feature-flag the presign/commit routes before production use. If compatibility is still required, presign only a staging key, then on commit validate bytes, copy/write them to a new non-presigned final key, persist that final key, and delete the staging object. Export packaging should also verify stored object bytes against the persisted checksum before writing a package.

### P1 - API error handling is still incomplete on protected routes

Evidence:

- `src/server/http/apiErrors.ts` provides `withApiErrorHandling`, but many routes do not use it.
- Examples: `src/app/api/correction-tasks/[taskId]/corrections/route.ts`, `src/app/api/images/[imageId]/slice-bboxes/route.ts`, `src/app/api/slice-crops/[cropId]/support-mask/route.ts`, and `src/app/api/projects/[projectId]/prediction-import-batches/route.ts`.
- These routes call `requireUser()` before their local domain-specific `try/catch`, so a stale but present session cookie bypasses proxy-level missing-cookie handling and can throw outside the route response contract.

Impact:

Customer-facing XHR/fetch calls can receive a generic 500 or framework error response instead of stable `{ ok: false, error: "UNAUTHENTICATED" }` / `FORBIDDEN` JSON. The current E2E coverage checks representative routes, not every protected API route.

Recommendation:

Make `withApiErrorHandling` mandatory for every non-public API route, or introduce a small route factory that performs auth, parameter extraction, and domain error mapping consistently. Add a static/unit check that protected `src/app/api/**/route.ts` files either use the wrapper or explicitly document why not.

### P1/P2 - Concurrent saves can fail version allocation

Evidence:

- Full-image semantic save reads the latest artifact version then creates `version: (last?.version ?? 0) + 1` in `src/app/api/images/[imageId]/mask/upload/route.ts`.
- Default support masks use the same pattern in `src/server/domain/slices.ts`.
- Crop support and crop semantic saves use the same pattern in `src/server/domain/cropSupportMasks.ts` and `src/server/domain/cropSemanticMasks.ts`.
- Slice classifications and prediction imports also allocate version numbers by reading latest version first.

Impact:

Two tabs or users saving the same artifact family at nearly the same time can race on `@@unique([artifactId, version])` or `@@unique([sliceInstanceId, version])`. One request may fail with a low-level unique constraint error after object storage has already been written. That produces poor UX and can create unnecessary storage churn. This matters for real annotation because multi-tab warning/soft lock is still deferred.

Recommendation:

Use a transaction-level advisory lock per artifact/slice, an atomic counter table, or bounded retry on Prisma `P2002` for version creation. Pair this with the deferred edit-session/multi-tab warning so users understand which version they are editing.

### P2 - Export generation is trial-sized, not production-sized

Evidence:

- `src/server/domain/exports.ts` and `src/server/domain/predictionAnalysisExports.ts` build ZIPs with JSZip and read every included object into memory with `getObjectBytes(...)`.
- Export APIs are synchronous request/response routes.
- There is no hard item-count or byte-budget cap at export creation time.

Impact:

Large customer projects can exhaust memory, block the app process, or hit reverse-proxy/request timeouts. Crop exports also repeatedly load original image bytes per crop item before JSZip overwrites duplicate paths, which amplifies cost for multi-crop source images.

Recommendation:

Keep this path for trial exports, but enforce explicit item/byte caps now. For production, move export creation to a background job and use streaming ZIP generation or shard packages by image/crop batch.

### P2 - Real iPad Safari validation is still not complete

Evidence:

- `docs/testing/README.md` and `docs/known-gaps.md` state that iPad Safari execution is deferred.
- `npm run test:e2e:ipad-prep` is preparation only and does not validate Apple Pencil, Safari memory behavior, file upload behavior, rotation, or Home Screen mode.

Impact:

The product is annotation-heavy and crop workflow decisions are partly motivated by iPad constraints. Physical-device behavior can still fail even while desktop Chrome and iPad-sized Chromium tests pass.

Recommendation:

Run the deferred real iPad Safari gate before treating the app as production-ready for tablet annotation. Convert every failure into a focused ticket rather than broad editor refactors.

### P2 - Editor and domain modules remain large

Evidence:

- `src/features/editor/EditorClient.tsx` has 1692 lines.
- `src/features/editor/CropSemanticEditorClient.tsx` has 1365 lines.
- `src/server/domain/exports.ts` has 1513 lines.
- `src/server/domain/predictionImportBatches.ts` has 1304 lines.

Impact:

The current split is workable, but future changes to save state, drawing behavior, crop readiness, and export semantics are high-risk because multiple concerns still live in large files.

Recommendation:

Continue incremental decomposition only when touching these areas. The best next splits are save/versioning services, export packaging builders, crop editor canvas hooks, and route-level API wrappers. Avoid a broad rewrite.

### P3 - Operational scripts allow password arguments on the command line

Evidence:

- `scripts/process-prediction-import-batch.mjs` and `scripts/storage-cleanup.mjs` accept `--password`.

Impact:

Passwords passed as CLI arguments can leak through shell history or process inspection. The scripts already support environment variables, which are better for the current Compose workflow.

Recommendation:

Deprecate the `--password` flags in docs, prefer environment variables or file-mounted secrets, and consider stdin-based password entry for manual use.

## Improvement Backlog

Recommended order:

1. Disable or stage-and-copy presigned compatibility uploads; add export-time checksum verification.
2. Wrap all protected API routes in the shared JSON error handler.
3. Add version-allocation retry/locking for artifact and classification saves.
4. Add export byte/item caps, then move large exports to jobs.
5. Execute real iPad Safari gate.
6. Add edit-session/multi-tab warning for large image/crop editors.
7. Add audit/review dashboards only after customer trial feedback confirms the needed workflow.

## Production Readiness Assessment

Current state is suitable for a controlled single-host customer trial with named users, local operator oversight, and dataset-size expectations kept within the documented trial limits.

It is not yet suitable as an unattended production annotation service for large teams or large datasets. The presigned upload immutability gap should be treated as the highest-priority blocker because it directly touches ground-truth integrity.
