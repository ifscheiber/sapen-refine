# Current State

## Purpose

This page records the repository state after the RB-049 through RB-063 annotation-domain, workflow, export, artifact-integrity, provenance, prediction-import, correction, prediction-analysis, batch-import, and project-operations routing slices.

## Important Files

- `package.json` - root scripts for Prisma generation, lint, typecheck, build, Vitest, Playwright E2E, and design-hardcoding checks.
- `prisma/schema.prisma` - current annotation-domain persisted model.
- `src/app/(public)/login/page.tsx` and `src/app/(public)/login/LoginForm.tsx` - public login route.
- `src/app/(workspace)/app/**` - protected App Router workspace URLs.
- `src/app/api/**` - current auth, project, image, mask, health, and readiness route handlers.
- `src/features/projects`, `src/features/images`, and `src/features/editor` - feature-owned workflow composition.
- `src/server/auth`, `src/server/runtime`, `src/server/storage`, and `src/server/uploads` - server-only auth, config, storage, and upload validation helpers.
- `src/mask` - current label constants, mask buffers, serialization, patching, and overlay rendering.
- `src/components/shell` and `src/design` - reusable workspace shell, UI primitives, design tokens, and editor canvas constants.
- `tests/e2e/desktop-browser-smoke.spec.ts` and `tests/e2e/ipad-viewport-prep.spec.ts` - current browser smoke coverage.

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

There is no `check:docs-links` script in `package.json` yet.

## Current Application Model

- Local login uses `src/app/api/auth/login/route.ts`, `src/server/auth/session.ts`, and the `User`/`Session` tables.
- Project membership is the current access boundary through `AnnotationProject` and `AnnotationProjectMember`; `src/server/auth/rbac.ts` enforces project roles for protected project/image workflows.
- Image upload uses app-mediated trial paths in `src/app/api/projects/[projectId]/images/upload/route.ts`; legacy presign/commit routes still exist for compatibility. Current raw image writes validate PNG/JPEG bytes, checksum, dimensions, size, and object metadata before persisting `ImageAsset`.
- Browser image reads use app-mediated routes such as `src/app/api/images/[imageId]/asset/route.ts` and `src/app/api/images/[imageId]/view/route.ts`.
- The editor route is `/app/projects/[projectId]/images/[imageId]/edit`, composed by `src/features/editor/EditImagePage.tsx` and `src/features/editor/EditorClient.tsx`.
- Mask save uses app-mediated upload through `src/app/api/images/[imageId]/mask/upload/route.ts`; legacy presign/commit routes still exist. Semantic and support masks are validated as image-sized `u8raw-v1` byte arrays before version rows are created.
- Latest mask reload uses `src/app/api/images/[imageId]/mask/latest/route.ts` and app-mediated version assets.
- Prediction mask import uses `src/app/api/prediction-runs/[predictionRunId]/predictions/route.ts` to validate and store private `PREDICTION_MASK` proposal artifacts linked to `PredictionArtifactProvenance`.
- Project operations use route-addressable pages: `/app/projects/[projectId]` for status/actions, `/images` for image work, `/tasks` for correction queues, `/exports` for training and prediction-analysis exports, and `/prediction-imports` for prediction batch imports.
- Batch prediction import uses `src/app/api/prediction-runs/[predictionRunId]/batch-imports/route.ts`, `src/app/api/prediction-import-batches/*`, `src/server/domain/predictionImportBatches.ts`, and `/app/projects/[projectId]/prediction-imports` to create ZIP-backed DB jobs/items and process items through the RB-057 import service.

## Current Data Model

- `AnnotationProject` is the standalone collaboration container and can reference an active label schema version.
- `ImageAsset` stores a raw object key, verified file metadata, checksum/dimensions, validation status, uploader, and metadata relations.
- `AnnotationArtifact` groups semantic/support/instance/prediction/derived artifacts by image, kind, and scope key.
- `AnnotationArtifactVersion` is append-only per artifact and stores artifact key, size, dimensions, checksum, format, label schema version, review state, provenance, creator, and timestamp.
- `AuditLog` records RB-055 upload, mask/support-mask, export creation, and export download events, but is not yet a complete attribution/audit trail for every route mutation.

## Invariants And Constraints

- URL-first workspace routes must remain stable while domain implementation evolves.
- Raw image objects should be treated as immutable after commit.
- Mask saves should append versions instead of overwriting previous versions.
- Writes must be tied to an authenticated user or an explicit future system actor.
- Development data may be destroyed during schema work; RB-049 replaces the baseline migration and uses `npm run db:rebuild`.

## Known Gaps

- The current schema models label schemas, annotation tasks/sessions, acquisition/sample metadata structures, review decisions, slice instances/classifications, export records, RB-056/RB-057 prediction provenance/import records, RB-058/RB-059 correction workflows, RB-060 prediction-analysis exports, and RB-061 batch prediction import jobs. RB-063 adds route-addressable project operations pages without schema changes.
- Copper masks are semantic material annotations; RB-051 adds the first separate support-mask workflow for one default slice per image.
- Upload hardening now covers the current raw image, semantic mask, support mask, prediction import, and export paths. Broader audit coverage, malware scanning, export jobs, always-on batch workers, and orphan/staging cleanup dashboards remain deferred.
- Real iPad Safari validation remains deferred until deployment/device access is available.

## Related Tickets / Docs

- [baseline-checks.md](baseline-checks.md)
- [../06-data/prisma.md](../06-data/prisma.md)
- [../06-data/mask-format.md](../06-data/mask-format.md)
- [../testing/README.md](../testing/README.md)
