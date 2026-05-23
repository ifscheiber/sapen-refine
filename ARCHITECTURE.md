# ARCHITECTURE.md - SaPen Annotate

This is the high-level architecture map. Detailed, evidence-backed documentation lives under [docs/](docs/). If this file and `docs/` disagree, update both and treat `docs/` as the implementation-level source of truth.

## Overview

SaPen Annotate is a standalone Next.js application for wood-slice annotation. The current MVP supports local login, project creation, validated PNG/JPEG image upload, metadata capture, editor access, source-image BBox slice proposals, derived slice crop generation, semantic/support mask commits, slice classification, minimal review/approval, owner-created training exports, model/prediction-run provenance persistence, server-side prediction mask import, assisted correction, prediction-analysis exports, and ZIP-backed batch prediction imports. It is intended to grow into an attributable training-data tool for heartwood/sapwood masks, copper masks, image/acquisition metadata, review/approval, reproducible dataset exports, and expanded prediction-assisted correction.

Scratch annotation is the primary product mode. Prediction-assisted correction is a secondary provenance-bearing mode. SaPen Core handoff workflows are future integrations and must remain explicit.

## System Boundaries

- Application boundary: `src/app` owns Next App Router route groups, pages, layouts, and API route handlers. Browser route files are thin composition points.
- Feature boundary: `src/features` owns workflow-specific project, image, and editor UI/composition.
- Shell/UI boundary: `src/components/shell` owns reusable workspace layout; `src/components/ui` owns generic primitives.
- Design boundary: `src/design` owns CSS-variable tokens, themes, and central canvas preview constants.
- Authentication boundary: `src/server/auth` owns session cookie handling, session persistence, and project-role checks.
- Database boundary: `prisma/schema.prisma` defines the current annotation-domain persisted model; `src/server/db.ts` owns Prisma client setup.
- Object storage boundary: `src/server/storage/s3.ts` owns the active S3/MinIO helpers for compatibility presign routes plus app-mediated object writes, reads, stat verification, object listing/deletion, and best-effort cleanup. The older flat `src/server/storage.ts` helper was removed by RB-069.
- Client helper boundary: `src/lib` wraps current browser-side API calls.
- Mask boundary: `src/mask` owns label constants, mask buffers, serialization, patching, tools, and overlay rendering helpers.
- Future SaPen Core/training boundary: integration must use explicit export or handoff contracts, not implicit shared project semantics.

## Current Technical Stack

- Next.js App Router with React client components.
- Prisma 7 with PostgreSQL.
- S3-compatible object storage, locally MinIO through [docker-compose.yml](docker-compose.yml).
- Customer-trial deployment baseline with Caddy, app, PostgreSQL, and MinIO through [deploy/docker-compose.trial.yml](deploy/docker-compose.trial.yml).
- Local email/password authentication seeded by [prisma/seed.ts](prisma/seed.ts) and [prisma/seed.mjs](prisma/seed.mjs).
- ESLint, TypeScript, Next build, Vitest, Prisma generation, and the design-hardcoding check as current validation gates.

## Current Data Model

The current schema in [prisma/schema.prisma](prisma/schema.prisma) is the RB-049 annotation-domain persistence baseline.

Persisted entities today:

- `User`, `Role`, `UserGlobalRole`, and `Session` for local auth.
- `AnnotationProject` and `AnnotationProjectMember` for collaboration scope.
- `LabelSchemaVersion` and `LabelDefinition` for stable label semantics.
- `ImageAsset`, `ImageAcquisitionMetadata`, and `SampleMetadata` for image references and metadata structures.
- `AnnotationTask` and `AnnotationSession` for assignment/edit context.
- `AnnotationArtifact` and `AnnotationArtifactVersion` for semantic/support/instance/prediction/derived artifacts.
- `SliceInstance`, `SliceBoundingBoxVersion`, `DerivedSliceCrop`, and `SliceClassificationVersion` for physical slice proposals, BBox planning history, derived crop persistence, crop support-mask lineage, and classification persistence.
- `ReviewDecision`, `ExportBatch`, `ExportItem`, and `AuditLog` for review/export/audit foundations.
- `ModelRun`, `PredictionRun`, `PredictionArtifactProvenance`, `PredictionImportBatchJob`, and `PredictionImportBatchItem` for model-assisted correction provenance and trial-sized batch prediction import bookkeeping.

Known workflow gaps include crop-constrained semantic editing, crop-aware exports/review integration, advanced export filters/history/async large-job handling, reviewer dashboards/bulk review, cleanup dashboards/committed-artifact retention policy, prediction dashboards/model reports, slice-classification prediction correction, and production-scale queue infrastructure beyond the current single-host trial worker. `MaskKind.PREDICTION` and `MaskKind.REFINED` are removed from the active schema; "refine" is reserved for a future prediction-correction mode, not the product name.

## Current Flows

- Login/session: `/login` is implemented under `src/app/(public)/login`; it posts to `/api/auth/login`, creates a database session, and sets `sapen_annotate_session`.
- Project list/create: `/app/projects` and `/api/projects` list memberships and create owner-scoped projects.
- Image upload: the customer-trial browser path posts to `/api/projects/[projectId]/images/upload`; the app server validates PNG/JPEG bytes, checksum, dimensions, and object metadata before storing the image row. Presign/commit routes remain compatibility paths with server-side commit validation.
- Workspace shell: `/app/**` routes live under `src/app/(workspace)/app` and compose feature modules through `src/components/shell`.
- Editor open: `/app/projects/[projectId]/images/[imageId]/edit` checks project role and renders `src/features/editor/EditorClient.tsx`.
- BBox slice proposals: the editor BBox mode stores source-image pixel rectangles through `/api/images/[imageId]/slice-bboxes` and `/api/slice-bboxes/[bboxVersionId]`. BBoxes are append-only proposal versions linked to `SliceInstance`; they are not support masks or export-ready ground truth.
- Derived slice crops: editable roles generate private PNG crops from current active BBox versions through `/api/slice-bboxes/[bboxVersionId]/crop`; crop metadata and assets are read through `/api/images/[imageId]/slice-crops` and `/api/slice-crops/[cropId]/asset` without exposing storage keys.
- Crop support masks: `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support` edits crop-sized binary support masks through `/api/slice-crops/[cropId]/support-mask`; saved versions use `CROP_PIXEL` and link to the source image, slice instance, and derived crop.
- Mask/classification save/reload: the editor posts semantic bytes to `/api/images/[imageId]/mask/upload`, support bytes to `/api/images/[imageId]/support-mask/upload`, and classifications to `/api/images/[imageId]/slice/classification`; latest artifacts are streamed through app-mediated version asset routes.
- Review/approval: `/api/images/[imageId]/review-state`, `/api/artifact-versions/[versionId]/review`, and `/api/slice-classification-versions/[versionId]/review` implement minimal draft/submitted/approved/rejected transitions and export-readiness state.
- Training export: `/app/projects/[projectId]/exports` uses `/api/projects/[projectId]/export/readiness` and `/api/projects/[projectId]/exports` to create owner-only approved-version exports; `/api/exports/[exportId]/download` streams manifest and ZIP package downloads through the app.
- Prediction provenance/import: `/api/model-runs/*`, `/api/projects/[projectId]/prediction-runs`, `/api/prediction-runs/[predictionRunId]`, `/api/prediction-runs/[predictionRunId]/predictions`, `/api/prediction-runs/[predictionRunId]/batch-imports`, and `/api/prediction-import-batches/*` persist/read model provenance and import one or many semantic/support prediction mask proposals through app-mediated routes.
- Prediction correction/analysis: `/app/projects/[projectId]/tasks`, `/app/projects/[projectId]/tasks/[taskId]/correct`, and `/api/projects/[projectId]/prediction-analysis-*` cover the first assisted correction and QA export workflows without changing ground-truth export eligibility.

## Security And Audit Assumptions

Current MVP protections:

- Route handlers call `requireUser` or `requireProjectRole` for protected workflows.
- Upload and mask commit routes require project membership.
- Trial browser storage access is app-mediated by default; compatibility presigned routes are constrained to server-generated keys and server-side commit validation.
- Current upload, mask, support-mask, export create, and export download paths record explicit `AuditLog` rows.
- Session cookies are HTTP-only, `sameSite=lax`, and secure in production.
- Login throttling, sanitized redirects, and same-origin browser mutation protection are implemented for the current local-auth trial model.

Known gaps:

- General write-rate limiting beyond login throttling and same-origin mutation protection is not implemented.
- Admin user-management and advanced export authorization policy are incomplete; RB-053 currently restricts export creation/download to project owners.
- Audit logging covers key mutation routes, but there is no audit UI or complete production attribution policy for every possible administrative action.
- Review decisions are append-only for the minimal RB-052 workflow, but full audit logging remains incomplete.

## Known Follow-Up Areas

- Route-level API auth/error contract hardening for stable JSON `401`/`403`/project-access failures.
- Trial deployment secret handling and Docker build-context hygiene.
- Explicit editor eraser UX, followed by deeper iPad/Pencil viewport interaction work.
- Client API wrapper cleanup and compatibility presign route policy.
- Prisma CLI audit/version policy review.
- Customer-trial deployment dry run, real iPad Safari gate execution, and post-trial triage.
- Advanced export filtering/history/async large-job handling on top of the RB-049 through RB-069 baseline.
- Prediction dashboards, model reports, and large analysis job handling beyond the current prediction-analysis export metrics.
- Reviewer dashboards, bulk review, and multi-reviewer approval policy.
- Mask format normalization and backward compatibility.
- Broader audit coverage, malware scanning, general API write-rate limiting, cleanup UI, committed-artifact retention governance, and production monitoring.
- Further prediction-assisted annotation/correction beyond the current semantic/support mask MVP.

See [docs/known-gaps.md](docs/known-gaps.md) and [docs/adr/remediation-backlog.md](docs/adr/remediation-backlog.md) for the working backlog.

## Documentation Links

- Docs index: [docs/README.md](docs/README.md)
- Annotation domain model: [docs/06-data/annotation-domain-model.md](docs/06-data/annotation-domain-model.md)
- Training export contract: [docs/06-data/training-export-contract.md](docs/06-data/training-export-contract.md)
- App routes and APIs: [docs/src/app/README.md](docs/src/app/README.md)
- Architecture baseline: [docs/01-architecture/module-boundaries.md](docs/01-architecture/module-boundaries.md)
- Server/auth/storage: [docs/src/server/README.md](docs/src/server/README.md)
- Masks: [docs/src/mask/README.md](docs/src/mask/README.md)
- Components/editor: [docs/src/components/README.md](docs/src/components/README.md)
- Client wrappers: [docs/src/lib/README.md](docs/src/lib/README.md)
- Prisma schema: [docs/prisma/README.md](docs/prisma/README.md)
- Testing: [docs/testing/README.md](docs/testing/README.md)
- ADRs: [docs/adr/README.md](docs/adr/README.md)
