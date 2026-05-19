# ARCHITECTURE.md — SaPen Annotate (Top-Level Map)

This file is a high-level architecture map.
`docs/` is the implementation-level system of record.
If anything here conflicts with docs, update this file to align.

---

## System Overview

SaPen Annotate is a standalone web application for creating high-quality, attributable, exportable ground-truth datasets for SaPen model training.

Primary workflow:

annotation project -> image upload + acquisition metadata -> annotation task -> mask editing -> versioned mask commit -> review/approval -> dataset export/manifest

The application focuses on annotation from scratch first. Assisted correction from model predictions and Core handoff workflows are later extensions.

---

## Repository Topology

Expected top-level structure:

- `src/app` – Next App Router routes, layouts, pages, and API routes
- `src/server` – server-only auth, RBAC, DB, storage, and domain services
- `src/mask` – mask formats, labels, patching, rendering helpers, coordinate-space logic
- `src/components` – reusable UI and editor components
- `src/lib` – client-side API wrappers and client utilities
- `src/assets` – static app assets
- `src/styles` – global styles/theme/font wiring
- `prisma` – Prisma configuration/schema/migrations if used in this repo
- `public` – public static assets
- `docs` – authoritative repository documentation mirrored to repo structure

Docs should mirror this topology where practical, for example:

- `docs/src/app/README.md`
- `docs/src/server/README.md`
- `docs/src/mask/README.md`
- `docs/src/components/README.md`
- `docs/src/lib/README.md`
- `docs/prisma/README.md`
- `docs/testing/README.md`
- `docs/adr/README.md`

---

## Product Modes and Boundaries

### 1. Standalone Annotation Mode — primary

Users create annotation projects directly in SaPen Annotate, upload images, record metadata, draw/edit masks, review/approve versions, and export training datasets.

This mode owns:
- annotation projects,
- image assets,
- T-number/image identifiers,
- acquisition metadata,
- semantic masks,
- instance/support masks,
- slice labels/classes,
- annotation/review state,
- dataset export manifests.

This mode must not depend on SaPen Core experiments.

### 2. Assisted Annotation / Pre-Prediction Mode — future

A future model may provide pre-predicted masks or uncertainty-ranked image queues.

Rules:
- predictions are inputs, not ground truth;
- human-approved masks remain separate versioned artifacts;
- prediction provenance must include model/run/checkpoint/config where available;
- uncertainty rankings must not change approved ground-truth state.

### 3. Core Handoff / Correction Mode — future integration

SaPen Core may later open Core-originated predictions in SaPen Annotate for correction through explicit handoff URLs/APIs.

Rules:
- Core-originated data must carry explicit provenance;
- Core predictions must never be overwritten;
- Annotate must not silently duplicate Core experiment/project ownership semantics;
- any returned artifact must be versioned and traceable.

---

## Core Domain Concepts

Conceptual model, not necessarily current schema:

- `User` – authenticated actor
- `Role` / `ProjectMember` – authorization and collaboration context
- `AnnotationProject` – top-level standalone dataset/project container
- `ImageAsset` – immutable raw uploaded image plus storage/provenance metadata
- `AcquisitionMetadata` – camera, exposure, color profile, operator, timestamp, etc.
- `AnnotationTask` – work item assigning image/labeling scope to a user or queue
- `LabelSchema` – versioned label definitions and allowed class values
- `Mask` – logical mask container for an image and mask kind
- `MaskVersion` – immutable stored mask artifact with author/provenance
- `SliceInstance` – instance/support representation of a detected/annotated wood slice
- `Review` / `Approval` – explicit quality-control state
- `ExportBatch` – reproducible dataset export with manifest and artifact references
- `AuditEvent` – immutable action/provenance record

Important distinction:
- Semantic labels (`SAPWOOD`, `HEARTWOOD`, `COPPER`) describe material/penetration classes.
- Instance/support masks describe object geometry and slice support.
- For copper slices, copper annotation may not cover the whole wood slice; therefore a separate instance/support mask may be required for instance-segmentation training.

---

## Runtime Model (Local Dev)

Expected local runtime components:

- Next.js application server
- Database, usually PostgreSQL if Prisma is used
- Object storage, local filesystem or S3-compatible storage
- Optional reverse proxy for integrated local SaPen deployments
- Optional worker/model service in future assisted annotation mode

Root scripts should be documented in `docs/README.md` and this section should be updated after repo hygiene.

Typical script groups to document:
- dev/start/build
- lint/typecheck/test
- prisma generate/migrate/studio
- storage/bootstrap helpers
- docs/link checks if present

---

## Architecture Principles

- URL-first: annotation workflows must be route-addressable.
- Backend as source of truth: API + DB own domain state transitions.
- Ground-truth integrity: raw images and approved mask versions are immutable artifacts.
- Attribution-first: all writes are tied to authenticated users or system actors.
- Versioned labels: mask semantics depend on explicit label-schema version.
- Clear product modes: scratch annotation is primary; predictions and Core handoff are separate future modes.
- Export reproducibility: exports must be reconstructable from stored artifacts and manifest state.
- Documentation mirrors implementation: docs must reference real repo paths.

---

## Canonical Technical Sources

Current/expected sources:

- App routes/API:
  - `src/app`
- Server-only infrastructure:
  - `src/server`
- Auth/session/RBAC:
  - `src/server/auth`
- Storage:
  - `src/server/storage`
- Mask semantics and formats:
  - `src/mask`
- UI/editor components:
  - `src/components`
- Client API wrappers:
  - `src/lib`
- Database model:
  - `prisma` and/or server DB module
- Repository documentation:
  - `docs/`

These paths must be updated if the repo is reorganized.

---

## Data and Storage Boundaries

### Raw images

Raw uploaded image files are immutable after commit.
The database should record:
- storage key,
- content type,
- size/checksum where available,
- width/height,
- upload actor,
- acquisition metadata,
- project ownership.

### Masks

Mask artifacts are versioned.
The database should record:
- mask kind,
- label schema version,
- image reference,
- dimensions/coordinate space,
- storage key,
- author,
- creation time,
- provenance.

### Exports

Dataset exports must be explicit export batches, not ad-hoc downloads.
Export manifests should include:
- project metadata,
- images and checksums,
- acquisition metadata,
- mask versions,
- label schema,
- review/approval state,
- export creator and timestamp,
- intended training target, e.g. semantic segmentation, slice classification, or instance segmentation.

---

## Testing Conventions (Link Only)

Testing policy and conventions should be documented in:
- `docs/testing/README.md`

Minimum recommended coverage areas:
- auth/RBAC for annotation and admin/export routes,
- project/image ownership,
- image upload commit validation,
- mask commit validation,
- mask serialization/deserialization,
- review/approval state transitions,
- export manifest completeness and reproducibility.

---

## Deep Docs (Authoritative)

- Docs index: `docs/README.md`
- App/API docs: `docs/src/app/README.md`
- Server docs: `docs/src/server/README.md`
- Mask docs: `docs/src/mask/README.md`
- Component/editor docs: `docs/src/components/README.md`
- Client library docs: `docs/src/lib/README.md`
- Prisma/domain docs: `docs/prisma/README.md`
- Testing docs: `docs/testing/README.md`
- ADR/backlog docs: `docs/adr/README.md`

---

End of file.
