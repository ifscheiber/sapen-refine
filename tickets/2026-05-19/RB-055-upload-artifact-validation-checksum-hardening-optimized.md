# RB-055 — Upload & Artifact Validation / Checksum Hardening

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Storage / API Hardening / Data Integrity / Audit / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-049 — Annotation Domain Schema Implementation Baseline
- RB-050 — Project, Image & Sample Metadata Workflow
- RB-051 — Slice Classification & Support-Mask Workflow Baseline
- RB-052 — Review & Approval Workflow Baseline
- RB-053 — Admin Training Export MVP
- RB-054 — Model Preprediction & Active-Learning Design

## Blocks

- RB-056 — Prediction Provenance / ModelRun Registry
- RB-057 — Prediction Import API and Storage Validation
- Any customer-facing use with valuable training data
- Any future prediction import relying on trusted storage metadata

---

## 1. Context

RB-050 added SHA-256 calculation for app-mediated image upload and exposed technical image metadata. RB-051 introduced separate semantic/support mask artifacts. RB-052 introduced review/approval. RB-053 introduced training export ZIP/manifest generation. RB-054 documented that future prediction import depends on reliable object validation and provenance.

The original RB-055 draft correctly states the core goal: harden raw image and annotation artifact writes so stored objects are trustworthy training-data inputs. It requires object existence/metadata validation, checksums, dimensions, content type/size checks, audit events, and docs/tests.

This optimized ticket turns that into a concrete implementation slice.

RB-055 is not a product-feature ticket. It is a data-integrity hardening ticket for all existing write paths:

- raw image upload,
- semantic mask commit,
- support mask commit,
- export package/manifest creation where appropriate,
- audit trail for upload/commit/export actions.

It must preserve all existing workflows and keep the current browser/E2E/export baseline green.

---

## 2. Goal

Make all persisted image and annotation artifacts trustworthy enough to serve as training-data inputs.

At the end of RB-055:

1. Raw image writes are server-validated.
2. Mask/artifact writes are server-validated.
3. Stored object existence, size, content type, dimensions, coordinate space and checksum are verified where applicable.
4. Oversized or inconsistent objects fail with stable API errors.
5. Audit events identify actor, project, image/artifact/version and action.
6. Export manifests use validated checksums and dimensions.
7. Existing browser, review and export workflows remain green.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- high-availability storage,
- external object storage migration,
- full malware scanning,
- model prediction import,
- model-run registry,
- background jobs,
- training orchestration,
- new metadata/product workflow,
- advanced EXIF parsing,
- changing export target semantics,
- broad schema redesign.

If a future need is identified, add/update backlog or follow-up tickets.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Start with:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
```

Work in focused slices and commit after each meaningful slice.

Because this ticket touches persistence/storage, run the full validation set after every major write-path change.

---

## 5. Hardening Principles

### 5.1 Server is source of truth

Do not trust client-provided:

- MIME/content type,
- byte size,
- image dimensions,
- mask dimensions,
- checksum,
- storage key,
- coordinate space.

Client may provide hints, but server must compute/verify persisted facts before committing database state.

### 5.2 Storage write + DB write must be consistent

Preferred order:

```text
validate input bytes
→ compute checksum/dimensions/size/content type
→ write object to storage
→ verify object exists / stat object if supported
→ persist DB row/version with verified metadata
```

If DB persistence fails after object write, document cleanup behavior. If cleanup is not implemented, add a backlog entry.

### 5.3 Stable API errors

Validation failures must return stable, sanitized errors.

Examples:

```text
UNSUPPORTED_CONTENT_TYPE
FILE_TOO_LARGE
IMAGE_DIMENSIONS_UNREADABLE
MASK_DIMENSIONS_MISMATCH
MASK_BYTE_LENGTH_MISMATCH
CHECKSUM_MISMATCH
OBJECT_WRITE_FAILED
OBJECT_STAT_FAILED
PROJECT_ACCESS_DENIED
```

Do not leak private MinIO/S3 URLs, credentials or raw stack traces.

### 5.4 Checksums

Use SHA-256 as canonical checksum format.

Recommended stored format:

```text
sha256:<hex>
```

If the database currently stores raw hex only, document the current format and normalize as much as practical without breaking tests.

### 5.5 Coordinate space

For current MVP:

```text
mask coordinate space = image pixel coordinate space
```

Semantic and support masks must match image width/height unless a future explicit transform model is introduced.

RB-055 should reject mismatches rather than invent transforms.

### 5.6 Export integrity

RB-053 export manifests must reference validated image/mask checksums and dimensions where available.

RB-055 should harden export generation so it fails or warns when required integrity metadata is missing.

Do not change RB-053 approved-only export semantics.

---

## 6. Scope

### 6.1 Central validation/storage helpers

Create or consolidate helpers for:

- SHA-256 calculation,
- canonical checksum formatting/comparison,
- file size validation,
- supported image content-type validation,
- server-side image dimension extraction,
- mask byte-length/dimension validation,
- object write/stat verification,
- stable validation error construction.

Suggested locations, adapt to current structure:

```text
src/server/storage/**
src/server/domain/artifacts/**
src/server/domain/images/**
src/server/domain/validation/**
src/features/editor/** only if a UI adapter is needed
```

Keep helpers testable and not route-bound.

### 6.2 Raw image upload hardening

Harden current app-mediated image upload path.

Requirements:

- enforce configured max upload size,
- allow only supported image types,
- compute SHA-256 server-side,
- extract dimensions server-side,
- persist verified `ImageAsset` metadata,
- validate object exists after upload where storage abstraction supports it,
- do not expose storage keys/private URLs to the browser,
- update `ImageAsset.validationStatus` consistently:
  - validated/ready where successful,
  - failed/rejected where invalid if a DB row is created,
  - no row for hard rejected uploads if cleaner.

Supported image types should be documented. For MVP, a limited set is fine, e.g.:

```text
image/png
image/jpeg
image/webp if already supported
```

Do not expand supported types unless existing code already handles them.

### 6.3 Semantic mask commit hardening

Harden semantic mask save/commit path.

Requirements:

- validate mask format/byte length,
- validate dimensions equal image dimensions,
- compute checksum server-side,
- write artifact object,
- verify object existence/size where possible,
- persist `AnnotationArtifactVersion` with:
  - checksum,
  - width,
  - height,
  - byte size,
  - content type/format,
  - coordinate space,
  - actor,
  - label schema version,
  - artifact kind = `SEMANTIC_MASK`,
  - review state = `DRAFT` for new edits.
- reject invalid masks with stable errors.

### 6.4 Support mask commit hardening

Harden support mask save/commit path.

Requirements:

- all semantic mask checks,
- artifact kind must be `SLICE_SUPPORT_MASK`,
- mask must be binary/support-compatible if current label format allows checking,
- support mask dimensions equal image dimensions,
- Copper semantic masks must not be accepted as support masks,
- `SliceInstance.supportArtifactVersionId` may only point to validated support artifact versions.

### 6.5 Export package hardening

Update export service from RB-053:

- manifest includes validated checksums/dimensions for image and masks where present,
- export should warn or fail for missing integrity metadata according to selected target,
- ZIP should include only objects that can be read through server/storage abstraction,
- package entries must not include private storage keys as public URLs,
- package manifest should remain deterministic for stable inputs.

### 6.6 Audit events

Add audit events for write actions.

Minimum actions:

```text
IMAGE_UPLOAD_ACCEPTED
IMAGE_UPLOAD_REJECTED
SEMANTIC_MASK_COMMITTED
SUPPORT_MASK_COMMITTED
ARTIFACT_VALIDATION_FAILED
EXPORT_CREATED
EXPORT_DOWNLOADED
```

If an `AuditEvent` model already exists, use it.

If no audit model exists, add a minimal schema migration for an append-only audit table, for example:

```text
AuditEvent
- id
- projectId nullable if needed
- imageId nullable if needed
- artifactId nullable
- artifactVersionId nullable
- exportBatchId nullable
- actorId
- action
- status
- metadataJson
- createdAt
```

Rules:

- audit must not store secrets,
- audit metadata may include stable error codes and object metadata,
- audit is append-only.

### 6.7 Configuration

Add or verify runtime config for:

- max image upload bytes,
- max mask/artifact bytes,
- supported image MIME types,
- optional export package size limit if already useful.

Update `.env.example` and deployment/trial docs.

Defaults should be suitable for customer trial but easy to adjust.

### 6.8 Tests

Add focused tests.

#### Unit tests

- checksum formatting/comparison,
- image content-type validation,
- file-size validation,
- mask byte-length/dimension validation,
- stable error code mapping.

#### Integration / route tests

- valid image upload persists verified checksum/dimensions/status.
- oversized image upload fails with stable error.
- unsupported content type fails with stable error.
- semantic mask dimension mismatch fails.
- support mask dimension mismatch fails.
- semantic artifact cannot be linked as support version.
- failed validation creates audit event where appropriate.
- valid commits create audit events.
- export manifest includes checksum/dimension fields.

#### E2E tests

Preserve existing E2E paths:

- metadata workflow,
- semantic/support/classification workflow,
- review/approval workflow,
- export workflow.

Extend only if stable and useful, e.g. verify upload error message for oversized/unsupported file if easy.

### 6.9 Documentation

Update:

```text
docs/03-features/images.md
docs/03-features/editor.md
docs/06-data/mask-and-artifact-versioning.md
docs/06-data/training-export-contract.md
docs/04-server/deployment-trial.md
docs/04-server/backup-restore.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must cover:

- supported image types,
- upload size limits,
- checksum format,
- mask dimension rules,
- stable error codes,
- audit actions,
- export integrity behavior,
- what remains deferred.

---

## 7. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Raw image upload computes and persists server-verified checksum, dimensions, size and content type.
3. Raw image upload enforces content type and size limits.
4. Invalid uploads fail with stable sanitized errors.
5. Semantic mask commit validates dimensions/byte length and records checksum/dimensions/size.
6. Support mask commit validates dimensions/byte length and records checksum/dimensions/size.
7. Copper semantic masks cannot be accepted as support geometry.
8. `SliceInstance.supportArtifactVersionId` cannot point to semantic artifact versions.
9. Stored object existence/metadata is verified after writes where storage abstraction supports it.
10. Audit events are recorded for upload/commit/export actions and validation failures where applicable.
11. Export manifests include validated checksums/dimensions or explicit warnings/failures.
12. No private MinIO/S3 URLs or secrets leak through API responses.
13. Tests cover success and failure paths for image upload, mask commits, support-mask integrity, audit events and export manifest integrity.
14. Existing browser workflows remain green.
15. Docs are updated and distinguish implemented vs deferred behavior.
16. Ticket is moved to:

```text
tickets/2026-05-19/done/
```

17. Final validation passes:

```bash
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
```

18. Final Codex report includes:
    - commits created,
    - schema changes if any,
    - files/routes changed,
    - tests added/changed,
    - stable error codes introduced,
    - audit actions introduced,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 8. Suggested Commit Sequence

```bash
git commit -m "docs: define upload artifact validation baseline"
git commit -m "feat: add artifact validation and checksum helpers"
git commit -m "feat: harden image upload validation"
git commit -m "feat: harden semantic and support mask commits"
git commit -m "feat: add audit events for artifact writes"
git commit -m "test: cover artifact validation failure modes"
git commit -m "docs: document storage integrity hardening"
git commit -m "chore: finalize artifact validation ticket"
```

---

## 9. Notes for Codex

- This ticket protects the trustworthiness of training data.
- Do not implement prediction import yet.
- RB-057 will rely on the validation helpers from this ticket.
- Prefer centralized helpers over route-local validation logic.
- Keep APIs stable and errors sanitized.
- Keep existing export and editor behavior green.
