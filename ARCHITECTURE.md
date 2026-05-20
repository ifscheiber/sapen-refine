# ARCHITECTURE.md - SaPen Annotate

This is the high-level architecture map. Detailed, evidence-backed documentation lives under [docs/](docs/). If this file and `docs/` disagree, update both and treat `docs/` as the implementation-level source of truth.

## Overview

SaPen Annotate is a standalone Next.js application for wood-slice annotation. The current MVP supports local login, project creation, validated PNG/JPEG image upload, metadata capture, editor access, semantic/support mask commits, slice classification, minimal review/approval, and owner-created training exports. It is intended to grow into an attributable training-data tool for heartwood/sapwood masks, copper masks, image/acquisition metadata, review/approval, reproducible dataset exports, and future prediction-assisted correction.

Scratch annotation is the primary product mode. Prediction-assisted correction and SaPen Core handoff workflows are future modes and must remain explicit provenance-bearing integrations.

## System Boundaries

- Application boundary: `src/app` owns Next App Router route groups, pages, layouts, and API route handlers. Browser route files are thin composition points.
- Feature boundary: `src/features` owns workflow-specific project, image, and editor UI/composition.
- Shell/UI boundary: `src/components/shell` owns reusable workspace layout; `src/components/ui` owns generic primitives.
- Design boundary: `src/design` owns CSS-variable tokens, themes, and central canvas preview constants.
- Authentication boundary: `src/server/auth` owns session cookie handling, session persistence, and project-role checks.
- Database boundary: `prisma/schema.prisma` defines the current annotation-domain persisted model; `src/server/db.ts` owns Prisma client setup.
- Object storage boundary: `src/server/storage.ts` and `src/server/storage/s3.ts` create presigned S3/MinIO URLs for compatibility paths and support app-mediated object writes, reads, stat verification, and best-effort cleanup.
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
- `SliceInstance` and `SliceClassificationVersion` for physical slice and classification persistence.
- `ReviewDecision`, `ExportBatch`, `ExportItem`, and `AuditLog` for review/export/audit foundations.

Known workflow gaps include advanced export filters/history/job handling, reviewer dashboards/bulk review, multi-slice support, and runtime prediction import/active-learning workflows. `MaskKind.PREDICTION` and `MaskKind.REFINED` are removed from the active schema; "refine" is reserved for a future prediction-correction mode, not the product name.

## Current Flows

- Login/session: `/login` is implemented under `src/app/(public)/login`; it posts to `/api/auth/login`, creates a database session, and sets `sapen_annotate_session`.
- Project list/create: `/app/projects` and `/api/projects` list memberships and create owner-scoped projects.
- Image upload: the customer-trial browser path posts to `/api/projects/[projectId]/images/upload`; the app server validates PNG/JPEG bytes, checksum, dimensions, and object metadata before storing the image row. Presign/commit routes remain compatibility paths with server-side commit validation.
- Workspace shell: `/app/**` routes live under `src/app/(workspace)/app` and compose feature modules through `src/components/shell`.
- Editor open: `/app/projects/[projectId]/images/[imageId]/edit` checks project role and renders `src/features/editor/EditorClient.tsx`.
- Mask/classification save/reload: the editor posts semantic bytes to `/api/images/[imageId]/mask/upload`, support bytes to `/api/images/[imageId]/support-mask/upload`, and classifications to `/api/images/[imageId]/slice/classification`; latest artifacts are streamed through app-mediated version asset routes.
- Review/approval: `/api/images/[imageId]/review-state`, `/api/artifact-versions/[versionId]/review`, and `/api/slice-classification-versions/[versionId]/review` implement minimal draft/submitted/approved/rejected transitions and export-readiness state.
- Training export: the project overview uses `/api/projects/[projectId]/export/readiness` and `/api/projects/[projectId]/exports` to create owner-only approved-version exports; `/api/exports/[exportId]/download` streams manifest and ZIP package downloads through the app.

## Security And Audit Assumptions

Current MVP protections:

- Route handlers call `requireUser` or `requireProjectRole` for protected workflows.
- Upload and mask commit routes require project membership.
- Trial browser storage access is app-mediated by default; compatibility presigned routes are constrained to server-generated keys and server-side commit validation.
- Current upload, mask, support-mask, export create, and export download paths record explicit `AuditLog` rows.
- Session cookies are HTTP-only, `sameSite=lax`, and secure in production.

Known gaps:

- Rate limiting and brute-force protection are not implemented.
- Admin user-management and advanced export authorization policy are incomplete; RB-053 currently restricts export creation/download to project owners.
- Audit logging is not complete enough for production attribution across every mutation route.
- Review decisions are append-only for the minimal RB-052 workflow, but full audit logging remains incomplete.

## Known Follow-Up Areas

- Advanced export filtering/history/job handling and prediction workflows on top of the RB-049/RB-053 schema baseline.
- Model-run provenance, prediction import, active-learning queues, and assisted correction editor workflow on top of the RB-054 design contract.
- Reviewer dashboards, bulk review, and multi-reviewer approval policy.
- Mask format normalization and backward compatibility.
- Advanced iPad/Pencil viewport interaction work beyond the RB-045 browser/iPad baseline.
- Broader audit coverage, malware scanning, rate limiting, and background cleanup for orphaned objects.
- Prediction-assisted annotation as a separate future refine/correction mode.

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
