# ARCHITECTURE.md - SaPen Annotate

This is the high-level architecture map. Detailed, evidence-backed documentation lives under [docs/](docs/). If this file and `docs/` disagree, update both and treat `docs/` as the implementation-level source of truth.

## Overview

SaPen Annotate is a standalone Next.js application for wood-slice annotation. The current MVP supports local login, project creation, image upload, editor access, mask commit, and latest-mask reload. It is intended to grow into an attributable training-data tool for heartwood/sapwood masks, copper masks, image/acquisition metadata, review/approval, and reproducible dataset exports.

Scratch annotation is the primary product mode. Prediction-assisted correction and SaPen Core handoff workflows are future modes and must remain explicit provenance-bearing integrations.

## System Boundaries

- Application boundary: `src/app` owns Next App Router route groups, pages, layouts, and API route handlers. Browser route files are thin composition points.
- Feature boundary: `src/features` owns workflow-specific project, image, and editor UI/composition.
- Shell/UI boundary: `src/components/shell` owns reusable workspace layout; `src/components/ui` owns generic primitives.
- Design boundary: `src/design` owns CSS-variable tokens, themes, and central canvas preview constants.
- Authentication boundary: `src/server/auth` owns session cookie handling, session persistence, and project-role checks.
- Database boundary: `prisma/schema.prisma` defines the current annotation-domain persisted model; `src/server/db.ts` owns Prisma client setup.
- Object storage boundary: `src/server/storage.ts` and `src/server/storage/s3.ts` create presigned S3/MinIO URLs for raw images and mask artifacts.
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

Known workflow gaps include metadata capture UI, support-mask workflow, review/approval workflow, export generation, stronger upload checksum/dimension validation, and future prediction import. `MaskKind.PREDICTION` and `MaskKind.REFINED` are removed from the active schema; "refine" is reserved for a future prediction-correction mode, not the product name.

## Current Flows

- Login/session: `/login` is implemented under `src/app/(public)/login`; it posts to `/api/auth/login`, creates a database session, and sets `sapen_annotate_session`.
- Project list/create: `/app/projects` and `/api/projects` list memberships and create owner-scoped projects.
- Image upload: the customer-trial browser path posts to `/api/projects/[projectId]/images/upload`, and the app server stores the object in S3/MinIO; presign/commit routes remain compatibility paths.
- Workspace shell: `/app/**` routes live under `src/app/(workspace)/app` and compose feature modules through `src/components/shell`.
- Editor open: `/app/projects/[projectId]/images/[imageId]/edit` checks project role and renders `src/features/editor/EditorClient.tsx`.
- Mask save/reload: the editor posts serialized bytes to `/api/images/[imageId]/mask/upload`; latest mask metadata comes from `/api/images/[imageId]/mask/latest`, and mask bytes are streamed through app-mediated version asset routes.

## Security And Audit Assumptions

Current MVP protections:

- Route handlers call `requireUser` or `requireProjectRole` for protected workflows.
- Upload and mask commit routes require project membership.
- Raw binary storage is accessed through short-lived presigned URLs.
- Session cookies are HTTP-only, `sameSite=lax`, and secure in production.

Known gaps:

- Rate limiting and brute-force protection are not implemented.
- Admin user-management and export authorization are incomplete.
- Upload commit hardening is incomplete: object existence, content length, checksums, dimensions, and content type need stronger verification.
- Audit logging is not complete enough for production attribution.
- Approved ground-truth immutability and review state are not fully modeled yet.

## Known Follow-Up Areas

- Metadata, support-mask, review, export, and prediction workflows on top of the RB-049 schema baseline.
- Mask format normalization and backward compatibility.
- Advanced iPad/Pencil viewport interaction work beyond the RB-045 browser/iPad baseline.
- Upload/commit validation hardening.
- Admin export and manifest reproducibility.
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
