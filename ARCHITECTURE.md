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
- Database boundary: `prisma/schema.prisma` defines the current MVP persisted model; `src/server/db.ts` owns Prisma client setup.
- Object storage boundary: `src/server/storage.ts` and `src/server/storage/s3.ts` create presigned S3/MinIO URLs for raw images and mask artifacts.
- Client helper boundary: `src/lib` wraps current browser-side API calls.
- Mask boundary: `src/mask` owns label constants, mask buffers, serialization, patching, tools, and overlay rendering helpers.
- Future SaPen Core/training boundary: integration must use explicit export or handoff contracts, not implicit shared project semantics.

## Current Technical Stack

- Next.js App Router with React client components.
- Prisma 7 with PostgreSQL.
- S3-compatible object storage, locally MinIO through [docker-compose.yml](docker-compose.yml).
- Local email/password authentication seeded by [prisma/seed.ts](prisma/seed.ts) and [prisma/seed.mjs](prisma/seed.mjs).
- ESLint, TypeScript, Next build, Vitest, Prisma generation, and the design-hardcoding check as current validation gates.

## Current Data Model

The current schema in [prisma/schema.prisma](prisma/schema.prisma) is MVP-level and not sufficient for final training-data workflows.

Persisted entities today:

- `User`, `Role`, `UserGlobalRole`, and `Session` for local auth.
- `Project` and `ProjectMember` for collaboration scope.
- `Image` for uploaded object references and basic file metadata.
- `Mask` and `MaskVersion` for versioned mask artifacts.
- `AuditLog`, present but not yet used as a complete audit trail.

Known model gaps include acquisition metadata, task queues, review/approval records, label-schema versions, export batches/manifests, stronger image checksums, and clearer standalone annotation terminology. `MaskKind.PREDICTION` and `MaskKind.REFINED` are legacy MVP names; “refine” is reserved for a future prediction-correction mode, not the product name.

## Current Flows

- Login/session: `/login` is implemented under `src/app/(public)/login`; it posts to `/api/auth/login`, creates a database session, and sets `sapen_annotate_session`.
- Project list/create: `/app/projects` and `/api/projects` list memberships and create owner-scoped projects.
- Image upload: clients request `/api/projects/[projectId]/images/presign`, upload to S3/MinIO, then call `/api/projects/[projectId]/images/commit`.
- Workspace shell: `/app/**` routes live under `src/app/(workspace)/app` and compose feature modules through `src/components/shell`.
- Editor open: `/app/projects/[projectId]/images/[imageId]/edit` checks project role and renders `src/features/editor/EditorClient.tsx`.
- Mask save/reload: the editor requests `/api/images/[imageId]/mask/presign`, uploads serialized bytes, commits through `/api/images/[imageId]/mask/commit`, and reloads through `/api/images/[imageId]/mask/latest`.

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

- Annotation domain model for tasks, metadata, label schemas, review, approval, and exports.
- Mask format normalization and backward compatibility.
- Advanced iPad/Pencil viewport interaction work beyond the RB-045 browser/iPad baseline.
- Upload/commit validation hardening.
- Admin export and manifest reproducibility.
- Prediction-assisted annotation as a separate future refine/correction mode.

See [docs/known-gaps.md](docs/known-gaps.md) and [docs/adr/remediation-backlog.md](docs/adr/remediation-backlog.md) for the working backlog.

## Documentation Links

- Docs index: [docs/README.md](docs/README.md)
- App routes and APIs: [docs/src/app/README.md](docs/src/app/README.md)
- Architecture baseline: [docs/01-architecture/module-boundaries.md](docs/01-architecture/module-boundaries.md)
- Server/auth/storage: [docs/src/server/README.md](docs/src/server/README.md)
- Masks: [docs/src/mask/README.md](docs/src/mask/README.md)
- Components/editor: [docs/src/components/README.md](docs/src/components/README.md)
- Client wrappers: [docs/src/lib/README.md](docs/src/lib/README.md)
- Prisma schema: [docs/prisma/README.md](docs/prisma/README.md)
- Testing: [docs/testing/README.md](docs/testing/README.md)
- ADRs: [docs/adr/README.md](docs/adr/README.md)
