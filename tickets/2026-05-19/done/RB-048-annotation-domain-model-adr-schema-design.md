# RB-048 — Annotation Domain Model ADR & Schema Design

## Status

Done

## Priority

High

## Type

Architecture / Domain Modeling / Data Model Design / ADR

## Repository

`sapen-annotate`

## Depends on

- RB-047 — Desktop Browser E2E Baseline & iPad Trial Preparation

## Blocks

- Annotation domain schema implementation
- Minimal customer annotation workflow
- Admin training export
- Model-assisted preprediction / active learning
- Core handoff/correction workflow

---

## 1. Context

SaPen Annotate now has a stable technical foundation:

- green validation baseline,
- modular App Router / feature structure,
- reusable App Shell and design tokens,
- iPad-ready editor input baseline,
- customer browser deployment baseline,
- desktop browser E2E smoke covering login → project → upload → editor → draw → save → reload → mask persistence,
- browser media reads routed through app routes instead of direct private MinIO URLs.

The next risk is no longer infrastructure, but domain correctness.

The current MVP schema and UI were sufficient for early drawing experiments, but the future standalone app must produce high-quality, attributable training data for SaPen models. Before changing Prisma models or implementing new features, the target annotation domain model must be designed and documented.

This ticket is intentionally a design/ADR ticket. It should not implement the schema yet.

---

## 2. Goal

Design the future SaPen Annotate domain model and persistence boundaries before implementation.

The result should be a clear, evidence-backed domain model that explains:

- what entities exist,
- who owns them,
- how images, metadata, labels, masks, slice instances, reviews, and exports relate,
- how attribution is preserved,
- how semantic masks differ from instance/support masks,
- how Copper annotations differ from Sapwood/Heartwood annotations,
- how future model preprediction/correction can fit without overwriting ground truth,
- how training exports can be generated reproducibly.

The output must be documentation, ADRs, diagrams or text models, and implementation tickets/backlog entries — not database migrations.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- Prisma schema migration,
- route/API implementation,
- UI implementation,
- editor rewrite,
- admin export implementation,
- model preprediction implementation,
- Core handoff implementation,
- migration of existing local development data,
- full permission system rewrite.

If implementation needs become obvious, create follow-up tickets instead of expanding this ticket.

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

2. Inspect current implementation and docs before writing the target model.
3. Reference real source paths when describing current behavior.
4. Clearly mark future/planned behavior as planned.
5. Work in meaningful slices.
6. At the end of each slice:
   - run relevant checks,
   - update docs,
   - create a detailed focused Git commit.
7. Do not mix unrelated completed slices in one commit.
8. Do not implement schema changes.

---

## 5. Domain Principles

The domain model must preserve these principles:

### 5.1 Raw image immutability

Uploaded raw images are immutable. Any correction, transformation, mask, metadata update, or export references the raw image but does not overwrite it.

### 5.2 Attribution

It must be clear who did what:

- who uploaded an image,
- who created/edited a mask,
- who reviewed/approved an annotation,
- who exported a dataset,
- when each action occurred.

### 5.3 Versioned ground truth

Ground-truth annotations must be versioned and traceable.

Predictions, corrections, and final accepted labels must not overwrite each other silently.

### 5.4 Semantic masks vs instance/support masks

The model must distinguish:

```text
Semantic material masks:
- Sapwood
- Heartwood
- Copper
- background/unknown

Instance/support masks:
- wood slice geometry/support area
- object instance boundaries
- optional detector support geometry

Slice classification labels:
- SAP_HEARTWOOD_SLICE
- COPPER_SLICE
- UNKNOWN / REVIEW_REQUIRED
```

This distinction is mandatory because Copper annotations may cover only the penetrated/copper-stained region, not the whole physical slice. Sapwood/Heartwood masks may often cover the slice more completely, but should still not be conflated with object-support geometry.

### 5.5 Label schema versioning

Training data must record which label schema/version was used.

Future changes to labels or semantics must not make older exports ambiguous.

### 5.6 Export reproducibility

Admin exports must be reproducible and auditable.

An export should include:

- images,
- masks,
- metadata,
- label schema version,
- manifest,
- export timestamp,
- exported by,
- selection/filter criteria,
- source annotation versions.

### 5.7 Future model assistance

Future preprediction/active-learning workflow must fit into the model:

- model prediction is an input/proposal,
- human annotation/correction is a separate versioned artifact,
- confidence/ranking may prioritize annotation tasks,
- model predictions must not become ground truth without explicit human action.

---

## 6. Required Current-State Review

Codex must inspect and document the current state of:

```text
prisma/schema.prisma
src/features/editor/**
src/features/images/**
src/features/projects/**
src/app/api/**
src/server/**
src/mask/**
docs/**
```

Document:

- current entities,
- current image ownership,
- current project model,
- current mask/mask-version model,
- current upload/read/write APIs,
- current auth/session attribution,
- current gaps relative to the target standalone training-data use case.

Update or create:

```text
docs/00-overview/current-state.md
docs/06-data/prisma.md
docs/06-data/mask-format.md
docs/03-features/editor.md
docs/03-features/images.md
docs/03-features/projects.md
docs/known-gaps.md
```

---

## 7. Required Target Domain Docs

Create or update the following docs:

```text
docs/06-data/annotation-domain-model.md
docs/06-data/annotation-label-schema.md
docs/06-data/mask-and-artifact-versioning.md
docs/06-data/training-export-contract.md
docs/01-architecture/domain-boundaries.md
docs/08-adr/ADR-003-annotation-domain-model.md
docs/08-adr/remediation-backlog.md
```

If the numbering of ADRs differs in the repository, use the next available ADR number and update this ticket/report accordingly.

---

## 8. Target Conceptual Entities

The design should evaluate and define at least the following conceptual entities. Exact Prisma names may differ later, but the domain concepts must be addressed.

### 8.1 AnnotationProject

Standalone annotation project, not a SaPen Core experiment.

Responsibilities:

- groups images and annotation tasks,
- owns label schema choice,
- owns project-level metadata/defaults,
- controls membership/access,
- supports export selection.

### 8.2 ImageAsset

Immutable uploaded image with storage key, checksum/hash, dimensions, file format, upload attribution, and acquisition metadata link.

### 8.3 ImageAcquisitionMetadata

Optional structured capture metadata:

- camera/device,
- lens/objective,
- exposure,
- aperture,
- ISO,
- white balance,
- color profile,
- lighting setup,
- capturedBy,
- capturedAt,
- notes,
- imported EXIF where available.

### 8.4 Sample / T-Number Metadata

The app must support customer/lab identifiers such as T-number.

Design should decide whether this belongs to ImageAsset, a Sample entity, a Specimen/Slice entity, or structured metadata rows.

Concepts:

- T-number,
- series/experiment reference,
- specimen identifier,
- slice index,
- replicate,
- treatment reference,
- free-form notes.

### 8.5 AnnotationTask

Assignable/reviewable work for one image or image region.

Task types may include:

- semantic material mask,
- slice support/instance mask,
- slice classification,
- review/approval,
- correction of model prediction.

### 8.6 AnnotationSession

Editing session or commit context recording actor, started/committed timestamps, tool/client version, and audit context.

### 8.7 LabelSchema / LabelSet

Defines allowed labels and their meaning:

- stable label ids,
- display names,
- semantic meaning,
- color token mapping,
- version,
- applicability to task types.

### 8.8 SemanticMaskVersion

Versioned semantic material mask scoped to image/task/project, label schema version, storage artifact, dimensions, format, creator, timestamp, provenance, and optional parent/source version.

### 8.9 InstanceMaskVersion / SliceSupportMaskVersion

Versioned instance/support geometry for physical slices. Must not be conflated with Copper semantic staining.

### 8.10 SliceInstance

Physical slice/object instance in an image, including imageId, support mask version, bounding box, slice class, sample/specimen metadata, and relationships to semantic masks.

### 8.11 Review / Approval

Human review and acceptance:

- status,
- reviewedBy,
- reviewedAt,
- comments,
- accepted mask versions,
- rejected/superseded versions,
- reason.

### 8.12 ExportBatch / ExportManifest

Admin-created training-data export:

- exportedBy,
- exportedAt,
- project/image/task filters,
- included image ids,
- included mask version ids,
- label schema version,
- manifest format,
- export artifact,
- reproducibility metadata.

---

## 9. Required Invariants

The design must specify hard and soft invariants.

### Hard invariants

- An image belongs to exactly one annotation project.
- Raw image storage object is immutable after upload.
- A mask version belongs to exactly one image and one annotation project.
- A mask version references exactly one label schema version.
- Mask dimensions must match the image or explicitly declare a coordinate transform.
- A reviewed/approved annotation references immutable mask/artifact versions.
- Export manifests reference exact immutable artifact versions.
- Model predictions must not overwrite human ground-truth versions.
- Actor attribution is required for create/edit/review/export events.

### Soft/readiness invariants

- Missing acquisition metadata may be allowed but should be export-visible.
- Images without approved annotations may be excluded or flagged in export.
- Copper semantic masks without slice support geometry should be allowed during annotation but flagged for instance-segmentation training readiness.
- Sapwood/Heartwood masks may be converted to support masks only through explicit documented rules.

---

## 10. Required Output: Schema Proposal Without Migration

Create a schema proposal document:

```text
docs/06-data/prisma-schema-proposal.md
```

It should include:

- proposed models,
- important fields,
- relationships,
- indexes/unique constraints,
- deletion/archive policy,
- migration implications,
- open questions.

Do **not** edit `prisma/schema.prisma` in this ticket unless only adding comments is explicitly justified. Preferred outcome: no Prisma schema change.

---

## 11. Required Output: Follow-Up Tickets

Create follow-up ticket drafts in the ticket backlog or docs backlog for:

1. Annotation domain schema implementation.
2. Minimal annotation project/image metadata workflow.
3. Slice classification and support-mask workflow.
4. Admin training export MVP.
5. Review/approval workflow.
6. Future model preprediction/active-learning workflow.

Use the next available RB numbers if the repo’s ticket convention allows it; otherwise add structured backlog entries.

---

## 12. Tests and Validation

Because this is mostly docs/ADR, no new runtime tests are strictly required unless helpers are changed.

Still run the final green baseline:

```bash
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
```

If docs-link checks exist, run them too:

```bash
npm run check:docs-links
```

---

## 13. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Current schema/API/editor/project/image/mask state is documented with real source references.
3. Target annotation domain model is documented.
4. Semantic masks, instance/support masks, and slice classification are clearly separated.
5. Copper-specific annotation issue is explicitly addressed.
6. Attribution and audit requirements are documented.
7. Label schema versioning is documented.
8. Export manifest contract is documented.
9. Future model preprediction/correction integration is documented without implementation.
10. Hard/soft invariants are listed.
11. Prisma schema proposal exists, but no migration is implemented.
12. Follow-up implementation tickets/backlog entries are created.
13. Existing validation gates remain green.
14. Ticket is moved to:

```text
tickets/2026-05-19/done/
```

15. Final Codex report includes:
    - commits created,
    - files/docs changed,
    - validation commands run,
    - pass/fail status,
    - open questions,
    - follow-up tickets created.

---

## 14. Suggested Commit Sequence

Codex may adapt the sequence, but commits should remain focused.

```bash
git commit -m "docs: record current annotation data model"
git commit -m "docs: define target annotation domain model"
git commit -m "docs: specify mask versioning and label schema"
git commit -m "docs: define training export contract"
git commit -m "docs: add annotation domain ADR and follow-up backlog"
git commit -m "chore: finalize annotation domain model ticket"
```

---

## 15. Notes for Codex

- This is the domain-design gate before schema implementation.
- Be precise and evidence-backed.
- Do not overfit to the current MVP schema if it is structurally wrong for training data.
- Because there is no production data, the later implementation may reset development data.
- However, this ticket itself should not implement that reset.
- Keep iPad and browser trial requirements in mind, but do not implement UI changes here.

---

## 16. Completion Notes

Implemented as a documentation/ADR-only slice. No Prisma schema migration, route/API change, editor change, or DB reset was performed.

Created target docs:

- `docs/06-data/annotation-domain-model.md`
- `docs/06-data/annotation-label-schema.md`
- `docs/06-data/mask-and-artifact-versioning.md`
- `docs/06-data/training-export-contract.md`
- `docs/06-data/prisma-schema-proposal.md`
- `docs/01-architecture/domain-boundaries.md`
- `docs/08-adr/ADR-003-annotation-domain-model.md`

Additional refinements included:

- implementation phasing for RB-049+ in `docs/06-data/prisma-schema-proposal.md`,
- current-to-target mapping table for MVP `Project`, `Image`, `Mask`, `MaskVersion`, `MaskKind.PREDICTION`, and `MaskKind.REFINED`,
- separate export targets for semantic segmentation, instance/support segmentation, slice classification, and combined manifests,
- stable machine-readable label ids and versioned semantic meanings as the source of truth,
- review states `draft`, `submitted`, `approved`, `rejected`, and `superseded`,
- future active-learning/preprediction task concepts including priority, uncertainty/confidence, model source, and task reason,
- ownership/access rules for annotate, review, and export,
- central Copper rule: Copper semantic masks are not slice support geometry.

Follow-up tickets created:

- RB-049 - Annotation Domain Schema Implementation
- RB-050 - Project, Image, And Sample Metadata Workflow
- RB-051 - Slice Classification And Support-Mask Workflow
- RB-052 - Review And Approval Workflow
- RB-053 - Admin Training Export MVP
- RB-054 - Model Preprediction And Active-Learning Design
- RB-055 - Upload Artifact Validation And Checksum Hardening
