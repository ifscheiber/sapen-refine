# Annotation Domain Model

## Purpose

This page defines the SaPen Annotate domain model. RB-049 implements the first persistence baseline for this model; workflow/UI depth remains split across RB-050+.

SaPen Annotate is the system of record for attributable annotation work that can become reproducible training data.

## Current Evidence

- Current MVP schema: `prisma/schema.prisma`
- Current image upload routes: `src/app/api/projects/[projectId]/images/*`
- Current mask routes: `src/app/api/images/[imageId]/mask/*`
- Current editor: `src/features/editor/EditorClient.tsx`
- Current mask labels and serialization: `src/mask/labels.ts`, `src/mask/serialize.ts`

## Core Concepts

### AnnotationProject

Standalone annotation project. It is not a SaPen Core experiment.

Responsibilities:

- groups image assets, tasks, memberships, and export settings,
- selects an active label schema version,
- owns default project metadata and workflow policy,
- scopes access for annotation, review, and export,
- provides the selection boundary for reproducible exports.

Implemented in RB-049 as `AnnotationProject`.

### ImageAsset

Immutable uploaded source image.

Required target fields:

- project ownership,
- storage key,
- filename and content type,
- byte size,
- checksum,
- dimensions,
- upload attribution,
- upload timestamp,
- validation status,
- optional acquisition metadata link.

Raw image storage objects must not be overwritten after commit. Corrections, transformations, masks, and exports reference the image asset instead.

Implemented in RB-049 as `ImageAsset`.

### ImageAcquisitionMetadata

Optional structured capture metadata associated with an image asset.

Planned fields:

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
- imported EXIF,
- notes.

Missing metadata may be allowed during annotation, but export manifests must make missing values visible.

### Sample And Slice Metadata

Customer/lab identifiers should not be hidden in free text once the workflow moves beyond MVP.

Planned concepts:

- sample or specimen id,
- T-number,
- series or experiment reference,
- treatment reference,
- slice index,
- replicate,
- free-form notes,
- optional relationship to one or more slice instances in an image.

RB-049 implements a first `SampleMetadata` structure tied to `ImageAsset`. RB-050 owns the full metadata workflow and any later normalization.

### AnnotationTask

Assignable work unit for an image, slice instance, or review target.

Planned task types:

- semantic material mask,
- slice support/instance mask,
- slice classification,
- review/approval,
- model prediction correction.

Task state should support at least open, in progress, submitted, blocked, done, and cancelled.

Active-learning and preprediction compatibility:

- priority,
- task reason,
- uncertainty score,
- confidence score,
- model source,
- prediction artifact source,
- queue/ranking context.

Model predictions must be proposals or inputs. They must not become ground truth without explicit human action and review state. RB-049 persists task priority, task reason, uncertainty/confidence, model source, and source artifact placeholders; model queue behavior remains RB-054.

### AnnotationSession

Editing or commit context for attribution and reproducibility.

Planned fields:

- actor,
- task,
- startedAt and committedAt,
- client version,
- tool mode,
- source artifact or parent version,
- audit context such as user agent when available.

Annotation sessions are useful for connecting many low-level edits to one committed artifact version.

### LabelSchema And LabelSet

Versioned definition of allowed labels and meanings.

Rules:

- stable machine-readable label ids are the source of truth,
- semantic meaning is versioned,
- display names and colors are UI metadata only,
- labels declare applicability to semantic masks, support masks, classification, or other task types,
- older mask versions and exports must remain interpretable after label changes.

See [annotation-label-schema.md](annotation-label-schema.md).

### Semantic Mask Versions

Versioned material mask artifact. RB-049 implements this through `AnnotationArtifact.kind = SEMANTIC_MASK` and immutable `AnnotationArtifactVersion` rows.

Planned fields:

- project and image ownership,
- task/session relationship,
- label schema version,
- artifact storage key,
- dimensions and coordinate space,
- format,
- creator and timestamp,
- provenance kind,
- parent/source version,
- review state.

Semantic material labels include sapwood, heartwood, copper, background, and unknown/review-required where the label schema defines them.

### Slice Support / Instance Mask Versions

Versioned physical slice/object geometry.

This is separate from semantic material masks. A support mask identifies the physical slice area or object instance geometry. It is not the same thing as a copper material mask. RB-049 implements this through `AnnotationArtifact.kind = SLICE_SUPPORT_MASK` or `INSTANCE_MASK`.

Copper-specific rule:

Copper semantic masks annotate copper-stained or penetrated material regions. They may cover only part of a wood slice and must not be used as physical slice support geometry.

### SliceInstance

Physical slice/object instance visible in an image.

Planned fields:

- project and image ownership,
- optional support mask version,
- bounding box or geometry summary,
- slice classification,
- sample/specimen metadata link,
- related semantic mask versions.

Slice classifications should include at least:

- `SAP_HEARTWOOD_SLICE`
- `COPPER_SLICE`
- `UNKNOWN`
- `REVIEW_REQUIRED`

### Review And Approval

Review/approval is a core ground-truth concept, not an export-only afterthought.

Required artifact states:

- `draft` - work in progress, not ready for review.
- `submitted` - annotator says the artifact is ready for review.
- `approved` - reviewer accepts the artifact for ground-truth use.
- `rejected` - reviewer rejects the artifact, with reason/comment.
- `superseded` - a newer artifact replaces this one while preserving history.

Approved artifacts must remain immutable and exportable by exact version id.

RB-049 implements `ReviewDecision` and artifact `reviewState` with:

- reviewed artifact version,
- status decision,
- reviewedBy,
- reviewedAt,
- comments/reason,
- accepted/rejected/superseded relationships where applicable.

### ExportBatch And ExportManifest

Admin-created training-data export. RB-049 adds `ExportBatch` and `ExportItem` persistence only; generation remains RB-053.

Planned fields:

- exportedBy,
- exportedAt,
- project filters and selection criteria,
- included image ids,
- included mask/support/classification version ids,
- label schema version,
- manifest format version,
- export artifact key,
- checksums and reproducibility metadata.

See [training-export-contract.md](training-export-contract.md).

## Ownership And Access Roles

Current `AnnotationProjectRole` values are `OWNER`, `QA`, `LABELER`, and `VIEWER`.

Planned role behavior:

- Annotate: `OWNER`, `QA`, and `LABELER` can create draft/submitted annotation artifacts.
- Review: `OWNER` and `QA` can approve, reject, or supersede submitted artifacts.
- Export: `OWNER` can create export batches by default; `QA` export access may be enabled by project policy.
- View: `VIEWER` can inspect permitted project data but must not create annotation, review, approval, or export writes.

Server-side route handlers must enforce these rules. Hiding UI controls is not sufficient.

## Hard Invariants

- An image asset belongs to exactly one annotation project.
- Raw image storage objects are immutable after commit.
- Every annotation artifact version belongs to exactly one project and one image.
- Every mask artifact version references exactly one label schema version.
- Mask dimensions must match the image or declare an explicit coordinate transform.
- Reviewed/approved annotations reference immutable artifact versions.
- Export manifests reference exact immutable artifact versions.
- Model predictions never overwrite human ground-truth versions.
- Actor attribution is required for create, edit, review, approval, export, and administrative actions.

## Soft Readiness Invariants

- Missing acquisition metadata may be allowed, but exports must make it visible.
- Images without approved annotations may be excluded or flagged in export.
- Copper semantic masks without slice support geometry may be allowed during annotation but should be flagged for instance/support training readiness.
- Sapwood/heartwood semantic masks may be converted to support masks only through explicit documented rules.

## Related Docs

- [annotation-label-schema.md](annotation-label-schema.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [training-export-contract.md](training-export-contract.md)
- [prisma-schema-proposal.md](prisma-schema-proposal.md)
- [../01-architecture/domain-boundaries.md](../01-architecture/domain-boundaries.md)
