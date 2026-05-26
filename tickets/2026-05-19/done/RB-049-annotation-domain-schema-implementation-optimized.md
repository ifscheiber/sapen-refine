# RB-049 — Annotation Domain Schema Implementation Baseline

## Status

Done

## Priority

High

## Type

Schema / Domain Model / Persistence / Compatibility Baseline

## Repository

`sapen-annotate`

## Depends on

- RB-048 — Annotation Domain Model ADR & Schema Design

## Blocks

- RB-050 — Project, Image, and Sample Metadata Workflow
- RB-051 — Slice Classification and Support-Mask Workflow
- RB-052 — Review and Approval Workflow
- RB-053 — Admin Training Export MVP
- RB-054 — Model Preprediction and Active-Learning Design
- RB-055 — Upload Artifact Validation and Checksum Hardening

---

## 1. Context

RB-048 documented the target annotation domain model. The next step is to implement the first Prisma schema baseline for that model.

This ticket must establish the persistence foundation without expanding the product workflow yet.

The current app already has a green technical and browser baseline, including E2E coverage for:

```text
login → project → upload → editor → draw → save → reload → mask persistence
```

RB-049 must preserve that baseline while replacing or isolating the early MVP persistence concepts.

The app is still in development and has no production data. A clean local database rebuild is acceptable and preferred over complex preservation migrations. However, the migration path and reset procedure must be explicit and documented.

---

## 2. Goal

Implement the first durable Prisma schema baseline for SaPen Annotate's standalone annotation domain.

At the end of this ticket, the database model should represent the core RB-048 concepts needed for later workflows:

- annotation projects,
- project membership / access roles,
- label schema versions and label definitions,
- immutable image assets,
- acquisition/sample/specimen/slice metadata structures,
- annotation tasks and sessions,
- semantic material mask versions,
- slice support / instance mask versions,
- slice instances and slice classification,
- review / approval records or states,
- export batch / manifest records where needed for later export,
- attribution fields for create/edit/review/export actions,
- artifact metadata needed for checksum/dimension hardening in RB-055.

This ticket may adapt existing API/server code only as much as required to keep the current browser workflow and tests green.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- full metadata UI workflow,
- full review/approval UI,
- admin training export generation,
- model preprediction or active-learning queue behavior,
- Core handoff/correction workflow,
- advanced editor rewrite,
- real customer data migration,
- broad authorization redesign beyond schema and minimal server compatibility,
- upload checksum enforcement beyond schema fields and minimal compatibility checks.

If implementation needs become obvious, create or update follow-up tickets instead of expanding this ticket.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Mandatory process:

1. Start with:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
```

2. Inspect RB-048 docs before changing schema, especially:
   - `docs/06-data/annotation-domain-model.md`
   - `docs/06-data/prisma-schema-proposal.md`
   - `docs/06-data/annotation-label-schema.md`
   - `docs/06-data/mask-and-artifact-versioning.md`
   - `docs/06-data/training-export-contract.md`
   - ADR for annotation domain model.
3. Work in focused slices.
4. At the end of each slice:
   - run relevant checks,
   - update docs,
   - create a detailed focused Git commit.
5. Preserve the existing browser workflow.
6. Do not leave the repository in a half-migrated state.

---

## 5. Implementation Scope

### 5.1 Current-to-target mapping

Before editing the schema, create/update:

```text
docs/06-data/current-to-target-schema-map.md
```

It must cover current concepts such as:

- `Project`,
- `ProjectMember` if present,
- `Image`,
- `Mask`,
- `MaskVersion`,
- `MaskKind.REFINED`,
- current upload/read/commit routes,
- current user/session attribution.

For each concept, decide:

```text
keep / rename / replace / isolate as compatibility debt / remove after DB reset
```

Acceptance:

- No legacy model is silently kept without a documented reason.
- `MaskKind.REFINED` is removed, replaced, or explicitly isolated as temporary compatibility debt.

### 5.2 Prisma schema baseline

Update `prisma/schema.prisma` according to the RB-048 schema proposal.

Codex may adjust exact model names if needed, but the implemented schema must address these domain concepts.

#### Project and access

- `AnnotationProject`
- `AnnotationProjectMember` or equivalent
- roles sufficient to distinguish owner/admin, annotator, reviewer, and export/admin where applicable.

#### Label schema

- `LabelSchemaVersion`
- `LabelDefinition`

Must support stable machine-readable label IDs, display names, semantic meaning, task/artifact applicability, color-token mapping, active/default version, and versioning.

#### Images and metadata

- `ImageAsset`
- `ImageAcquisitionMetadata`
- sample/specimen/slice metadata structure sufficient for later RB-050.

Must support T-number/lab identifier, specimen identifier, slice index, replicate, treatment/reference placeholder, notes, acquisition metadata, and uploadedBy/uploadedAt attribution.

#### Tasks and sessions

- `AnnotationTask`
- `AnnotationSession`

Must support task type, status, assignee/creator, priority, future prediction/active-learning source fields or documented placeholders, session actor and commit timestamps.

#### Artifacts and masks

Implement either separate concrete models or a generic artifact model with typed variants, but the semantics must remain clear for:

- `SemanticMaskVersion`
- `SliceSupportMaskVersion` / `InstanceMaskVersion`
- optional source/parent artifact version
- artifact storage metadata: storage key, content type, byte size, checksum field, dimensions, coordinate space/transform, label schema version, createdBy/createdAt, provenance.

Hard rule:

```text
Copper semantic material masks must not be represented as slice support geometry.
```

#### Slice instance and classification

- `SliceInstance` or equivalent
- slice classification concept:
  - `SAP_HEARTWOOD_SLICE`
  - `COPPER_SLICE`
  - `UNKNOWN`
  - `REVIEW_REQUIRED`

Must preserve actor and version context where applicable.

#### Review / approval

Represent review/approval persistence sufficiently for RB-052:

- draft/submitted/approved/rejected/superseded status,
- reviewer,
- timestamps,
- comments/reason,
- accepted/rejected artifact versions.

#### Export records

Represent export persistence sufficiently for RB-053:

- `ExportBatch`
- `ExportManifest` or equivalent
- exportedBy/exportedAt,
- selection criteria,
- included immutable artifact/image/version references,
- manifest checksum/storage key if applicable,
- warnings/metadata completeness summary.

This ticket does not implement export generation.

### 5.3 Clean migration / rebuild strategy

Because there is no production data, prefer a clean development migration.

Required:

- create Prisma migration(s),
- document local reset/rebuild path,
- update seed strategy if needed,
- ensure `prisma migrate deploy` remains usable in trial deployment.

Do not rely on manual DB edits.

### 5.4 Seed/default label schema

Add or update seed/bootstrap logic so the default label schema exists in local/trial DBs.

Minimum default labels:

```text
background
unknown
sapwood
heartwood
copper
slice_support
review_required
```

If the model separates semantic labels from classification labels, also seed:

```text
SAP_HEARTWOOD_SLICE
COPPER_SLICE
UNKNOWN
REVIEW_REQUIRED
```

Seed must be idempotent.

### 5.5 Preserve current browser workflow

The current E2E flow must remain green:

```text
login → project → upload → editor → draw → save → reload → mask persistence
```

If schema changes require route/server updates, make the smallest compatibility changes needed.

Rules:

- Do not add the full RB-050 metadata UI.
- Do not add the RB-052 review workflow.
- Do not add export UI.
- Route behavior may continue exposing “projects/images/masks” language if the UI still uses it, but persistence must map to the new domain concepts or a documented compatibility layer.
- Any temporary compatibility layer must be documented and added to backlog if it should be removed later.

### 5.6 DB/domain tests

Add focused tests for domain persistence and invariants.

At minimum, cover:

- default label schema seed exists and is idempotent,
- image asset belongs to one annotation project,
- semantic mask artifact and support mask artifact are distinct,
- copper semantic artifact cannot be treated as support artifact by helper/domain logic,
- artifact versions carry actor attribution and label schema version,
- approved/export-ready references point to immutable version IDs where implemented,
- existing browser E2E still passes.

Use route-handler/integration-style tests where practical; avoid brittle UI-only tests.

### 5.7 Documentation updates

Update:

```text
docs/06-data/prisma.md
docs/06-data/prisma-schema-proposal.md
docs/06-data/annotation-domain-model.md
docs/06-data/mask-and-artifact-versioning.md
docs/03-features/projects.md
docs/03-features/images.md
docs/03-features/editor.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must distinguish implemented in RB-049, planned for RB-050+, and temporary compatibility debt.

---

## 6. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Current-to-target schema mapping is documented.
3. Prisma schema implements the first annotation-domain baseline.
4. A migration exists and the local rebuild path is documented.
5. Default label schema seed/bootstrap is idempotent.
6. Semantic mask versions and support/instance mask versions are distinct in schema and domain tests.
7. Copper semantic masks cannot be silently used as slice support geometry.
8. Attribution fields exist for image upload, artifact creation, review/export records where applicable.
9. Review/approval persistence shape exists for later workflow implementation.
10. Export batch/manifest persistence shape exists for later export implementation, or a documented reason explains why this is deferred.
11. Current browser E2E flow remains green.
12. Tests cover the most important schema/domain invariants.
13. `MaskKind.REFINED` is removed, replaced, or explicitly isolated as compatibility debt.
14. Docs are updated and accurately distinguish implemented vs planned behavior.
15. Ticket is moved to:

```text
tickets/2026-05-19/done/
```

16. Final validation passes:

```bash
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
```

17. Final Codex report includes commits created, migrations created, schema models/enums added/removed, compatibility/debt notes, validation commands run, pass/fail status, and follow-up ticket/backlog updates.

---

## 7. Suggested Commit Sequence

```bash
git commit -m "docs: map mvp schema to annotation domain model"
git commit -m "schema: add annotation domain persistence baseline"
git commit -m "seed: add default annotation label schema"
git commit -m "test: cover annotation domain schema invariants"
git commit -m "refactor: preserve browser workflow on annotation schema"
git commit -m "docs: document annotation schema baseline"
git commit -m "chore: finalize annotation schema ticket"
```

---

## 8. Notes for Codex

- This is the schema implementation gate, not the feature workflow gate.
- Keep the existing browser workflow green.
- Prefer clean development reset over complicated preservation migrations.
- Do not overfit the new schema to old MVP names.
- Do not treat Copper semantic staining as physical slice support.
- Do not silently keep old `MaskKind.REFINED` semantics.
- Add small compatibility code only where needed to preserve tests and E2E.

---

## 9. Completion Notes

Implemented as the first annotation-domain persistence baseline.

Key results:

- Replaced the previous MVP migration with `prisma/migrations/20260519213000_annotation_domain_baseline/migration.sql`.
- Added `AnnotationProject`, `AnnotationProjectMember`, `ImageAsset`, acquisition/sample metadata, label schema versions/definitions, annotation tasks/sessions, annotation artifacts/versions, slice instances/classifications, review decisions, export batches/items, and supporting enums.
- Removed `MaskKind.PREDICTION` and `MaskKind.REFINED` from the active Prisma schema.
- Preserved the current browser route/API flow by mapping current project/image/mask routes to the new persistence model.
- Current editor saves now create draft `SEMANTIC_MASK` `AnnotationArtifactVersion` rows.
- Added idempotent default label schema seed/bootstrap in `prisma/seed.mjs` and kept `prisma/seed.ts` aligned.
- Added DB integration coverage in `tests/integration/annotation-domain-schema.test.ts`.
- Documented the current-to-target mapping, rebuild path, implemented-vs-planned behavior, and DB-backed test prerequisite.

Compatibility/debt:

- Public route names remain `/projects`, `/images`, and `/mask` for browser compatibility.
- Metadata, support-mask, review/approval, export generation, and checksum enforcement workflows remain RB-050 through RB-055.
- `npm run test` now includes a local PostgreSQL integration test and expects the local DB to be running, migrated, and seeded.
