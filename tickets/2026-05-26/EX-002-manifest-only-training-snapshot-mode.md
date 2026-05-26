# EX-002 — Manifest-Only Training Dataset Snapshot Mode

## Status

Planned

## Priority

P1

## Type

Export / Manifest / Object Storage / Training Handoff / Backend

## Repository

`sapen-annotate`

## Read-only dependency

`../sapen-cnn` may be inspected for compatibility only. Do not edit it.

## Depends on

- EX-001 — SaPen-CNN Training Dataset Snapshot Contract
- Existing async export job infrastructure from RB-112
- Existing `ExportBatch` / `ExportItem` persistence
- Existing package writer boundary in `src/server/domain/exportPackageWriter.ts`

## Blocks

- EX-003 — Full-Image Training Dataset Derived From Crop Annotations
- EX-004 — Crop Semantic Training Dataset Snapshot
- EX-005 — Annotate-Side Local SaPen-CNN Dataset Materializer

---

## 1. Context

The current export system creates an `ExportBatch`, snapshots the manifest into `metadataSummary.manifestSnapshot`, stores `packageSources`, and later writes a `manifest.json` plus `package.zip` through the async worker.

For training, ZIP must not be the primary path. The efficient training path is:

```text
sapen-annotate API -> reproducible manifest snapshot
local materializer -> direct object-storage downloads from IONOS/S3 -> local sapen-cnn-compatible dataset
```

Therefore, `sapen-annotate` needs a manifest-only snapshot mode that preserves the existing async/audit/readiness behavior but does not require generating a ZIP package.

---

## 2. Goal

Extend the existing export/snapshot workflow with a manifest-only training dataset mode.

The mode must:

1. Create an immutable `ExportBatch`/snapshot row.
2. Persist exact selected source references and package/object refs in `metadataSummary`.
3. Write or expose a manifest object without ZIP packaging.
4. Preserve current ZIP export behavior as the default/backward-compatible mode.
5. Keep browser-facing API responses safe by default and avoid leaking private object-storage keys to normal users.
6. Provide an operator/service path for local training materialization to resolve storage objects or presigned URLs.

---

## 3. Implementation scope

### 3.1 API contract

Extend export creation to accept a transport/package mode, for example:

```json
{
  "targets": ["..."],
  "packageMode": "manifest_only"
}
```

or a similar validated field.

Supported modes:

```text
zip            existing behavior; default for backwards compatibility
manifest_only  write/expose manifest only; no package.zip required
```

Do not break existing clients that omit the field.

### 3.2 Persistence

Reuse `ExportBatch` if possible.

Recommended metadata additions inside `metadataSummary`:

```json
{
  "packageMode": "manifest_only",
  "manifestSnapshot": { ... },
  "objectSources": [ ... ],
  "itemCount": 123,
  "warningCount": 0,
  "estimatedBytes": 123456789
}
```

Keep existing fields where meaningful:

```text
manifestStorageKey
manifestChecksum
packageStorageKey = null for manifest_only
packageChecksum = null for manifest_only
packageSize = null for manifest_only
```

If a schema change is necessary, keep it minimal and justified. Prefer JSON metadata when adequate.

### 3.3 Worker behavior

Update the async export processor so that:

- `zip` mode keeps the existing `writeExportPackageObjects()` behavior.
- `manifest_only` mode writes only `manifest.json` to the export prefix and sets the batch to `COMPLETED`.
- integrity checks for referenced source objects remain enforced where currently required.
- non-retryable integrity failures remain terminal.
- retry behavior, stale lease recovery, audit events and status transitions remain unchanged.

Suggested new small writer boundary:

```text
src/server/domain/exportManifestWriter.ts
```

or extend `exportPackageWriter.ts` carefully without making it large.

### 3.4 Safe object access strategy

Normal browser/API summary responses must not expose raw private storage keys.

Add one of these safe approaches:

#### Option A: operator-only storage-ref endpoint

An operator/service endpoint returns internal object refs for local materialization only.

Example:

```text
GET /api/exports/:exportId/materialization-refs
```

Requirements:

- restricted to OWNER/QA or an explicit operator/service guard,
- not linked from normal UI unless intentionally exposed,
- audit access,
- stable error contract.

#### Option B: presigned URL materialization manifest

Generate time-limited URLs for local materialization.

Requirements:

- URLs are short-lived,
- regenerated on demand,
- not stored permanently in the immutable manifest,
- audit access.

For this sprint, choose the smallest secure option consistent with existing auth/storage code.

### 3.5 UI behavior

Keep UI changes minimal.

If a UI change is made, the Project Exports panel should clearly show:

```text
Mode: ZIP package | Manifest-only snapshot
Downloads: manifest available; package not available for manifest-only
```

Do not build a large dataset-builder UI in this ticket.

---

## 4. Non-goals

Do not implement here:

- crop-derived full-image instance mask generation,
- crop semantic dataset-specific manifest sections,
- local filesystem materialization,
- `sapen-cnn` scripts or code changes,
- model training orchestration,
- external customer handoff archive changes.

---

## 5. Acceptance criteria

- Existing ZIP export tests still pass.
- A new manifest-only export/snapshot can be created and reaches `COMPLETED` without a `package.zip`.
- Manifest-only exports store `manifestStorageKey` and `manifestChecksum`.
- Manifest-only exports leave package fields null or explicitly absent.
- Existing `PENDING`/`PROCESSING`/`COMPLETED`/`FAILED` lifecycle remains consistent.
- Export summaries and download links do not advertise a package download for manifest-only snapshots.
- Normal API responses still omit private storage keys.
- An operator/service path exists for resolving materialization object refs or presigned URLs, or a documented follow-up is created if intentionally deferred.
- Audit events distinguish manifest-only snapshot creation from ZIP package creation.
- Documentation is updated.

---

## 6. Suggested files to inspect/edit

Inspect/edit in `sapen-annotate`:

```text
src/server/domain/exports.ts
src/server/domain/exportJobs.ts
src/server/domain/exportPackageWriter.ts
src/app/api/projects/[projectId]/exports/route.ts
src/app/api/exports/[exportId]/route.ts
src/app/api/exports/[exportId]/download/route.ts
src/features/projects/ProjectExportPanel.tsx
docs/06-data/training-export-contract.md
prisma/schema.prisma only if unavoidable
```

Read-only inspection in `../sapen-cnn` if needed:

```text
../sapen-cnn/models/sapen_instseg/data/dataset.py
../sapen-cnn/models/sapen_clsf/dataset.py
../sapen-cnn/models/sapen_semseg/data/dataset.py
```

---

## 7. Validation

Run from `sapen-annotate`:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run test -- tests/integration/export-workflow.test.ts tests/integration/review-export-db-constraints.test.ts
npm run test:e2e -- tests/e2e/desktop-browser-smoke.spec.ts
```

If schema is changed:

```bash
npm run prisma:migrate:deploy
npm run prisma:generate
```

---

## 8. Codex prompt

You are working in `sapen-annotate`. `../sapen-cnn` is read-only and must not be modified.

Implement a manifest-only training dataset snapshot mode using the existing `ExportBatch`/async export infrastructure. Preserve current ZIP behavior as default. Add a validated `packageMode`/transport mode for manifest-only snapshots, write `manifest.json` without writing `package.zip`, keep private storage keys out of normal API responses, and provide or document a secure operator/service path for local materialization to resolve object refs or presigned URLs. Keep the worker lifecycle, retry behavior, leases, audit events and error contracts consistent with the existing export implementation. Update tests and docs.
