# Annotation Domain Model

## Purpose

This page defines the SaPen Annotate domain model. RB-049 implements the first persistence baseline for this model, RB-050 adds the first project/image/sample metadata workflow, RB-051 adds the first default-slice support-mask/classification workflow, RB-052 adds the first review/approval workflow, RB-053 adds the first owner-only training export workflow, RB-054 documents the model preprediction/active-learning design contract, and RB-086 adds source-image BBox slice proposal persistence. Runtime crop generation, advanced export policy, and multi-slice workflow depth remain split across later tickets.

SaPen Annotate is the system of record for attributable annotation work that can become reproducible training data.

## Current Evidence

- Current MVP schema: `prisma/schema.prisma`
- Current image upload routes: `src/app/api/projects/[projectId]/images/*`
- Current image metadata route: `src/app/api/images/[imageId]/metadata/route.ts`
- Current image metadata UI: `src/features/images/ImageMetadataPage.tsx`, `src/features/images/ImageMetadataClient.tsx`
- Current mask routes: `src/app/api/images/[imageId]/mask/*`
- Current editor: `src/features/editor/EditorClient.tsx`
- Current mask labels and editor raw-byte upload helper: `src/mask/labels.ts`, `src/features/editor/editorMaskUpload.ts`
- Legacy/test mask serialization helper: `src/mask/serialize.ts`
- Current review domain/API: `src/server/domain/review.ts`, `src/app/api/images/[imageId]/review-state/route.ts`, `src/app/api/artifact-versions/[versionId]/review/route.ts`, `src/app/api/slice-classification-versions/[versionId]/review/route.ts`
- Current BBox proposal domain/API: `src/server/domain/sliceBboxes.ts`, `src/app/api/images/[imageId]/slice-bboxes/route.ts`, `src/app/api/slice-bboxes/[bboxVersionId]/route.ts`
- Current training export domain/API: `src/server/domain/exports.ts`, `src/app/api/projects/[projectId]/export/readiness/route.ts`, `src/app/api/projects/[projectId]/exports/route.ts`, `src/app/api/exports/[exportId]/download/route.ts`
- Current prediction-analysis export domain/API: `src/server/domain/predictionAnalysisExports.ts`, `src/app/api/projects/[projectId]/prediction-analysis-export/readiness/route.ts`, `src/app/api/projects/[projectId]/prediction-analysis-exports/route.ts`, `src/app/api/prediction-analysis-exports/[exportId]/download/route.ts`
- Prediction/active-learning design: `docs/06-data/model-prediction-contract.md`, `docs/06-data/active-learning-task-model.md`

## Core Concepts

### AnnotationProject

Standalone annotation project. It is not a SaPen Core experiment.

Responsibilities:

- groups image assets, tasks, memberships, and export settings,
- selects an active label schema version,
- owns default project metadata and workflow policy,
- scopes access for annotation, review, and export,
- provides the selection boundary for reproducible exports.

Implemented in RB-049 as `AnnotationProject`. RB-050 surfaces project name, description, membership role, timestamps, and active label schema state in `src/features/projects/ProjectOverview.tsx`.

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

Implemented in RB-049 as `ImageAsset`. RB-050 displays immutable upload facts in the image metadata UI. RB-055 validates PNG/JPEG content, computes canonical SHA-256 checksums, extracts dimensions server-side, verifies stored object metadata, and persists successful uploads as `VALIDATED`.

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

RB-050 implements editable image-level acquisition metadata for project roles `OWNER`, `QA`, and `LABELER`. Missing metadata may be allowed during annotation, but export manifests must make missing values visible.

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

RB-049 implements a first `SampleMetadata` structure tied to `ImageAsset`. RB-050 implements this as image-level/default sample metadata with editable T-number, specimen identifier, slice index, replicate, treatment/reference, and notes.

Slice-specific sample metadata is not implemented in RB-050. If one image contains multiple slice instances with different sample metadata, RB-051/RB-052 must model the relationship through `SliceInstance` or a later normalized sample entity.

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
- model source as display/compatibility context,
- prediction run and item provenance links,
- prediction artifact source,
- queue/ranking context.

Model predictions must be proposals or inputs. They must not become ground truth without explicit human action and review state. RB-049 persists task priority, task reason, uncertainty/confidence, model source, and source artifact placeholders; RB-056 adds structured prediction-run and prediction-item provenance links.

RB-054 defines the future queue ordering and task reasons. Runtime task queue APIs and assignment UI remain follow-up work.

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

RB-051 implements the first user workflow for `SLICE_SUPPORT_MASK` only. It uses `AnnotationArtifact.scopeKey = "default"` and appends draft human `AnnotationArtifactVersion` rows.

RB-055 validates support-mask bytes against the target image dimensions and allows only `0` plus the active label schema's `slice_support` byte. A semantic Copper mask cannot be committed as support geometry.

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

RB-051 creates or reuses one default `SliceInstance` per image and links it to the latest default support-mask version when available. This is an MVP convention, not the final multi-slice model.

RB-086 creates one `SliceInstance` for each new source-image BBox proposal. The BBox history is stored in append-only `SliceBoundingBoxVersion` rows with `SOURCE_IMAGE_PIXEL` geometry. `SliceInstance.boundingBox` is a denormalized current summary and is cleared when the latest BBox version is `DELETED`.

`SliceBoundingBoxVersion` is a planning/provenance artifact for crop generation. It is not physical support geometry and is not exported as ground-truth instance segmentation.

`SliceClassificationVersion` stores draft classification versions with actor attribution and label schema version. RB-051 supports `SAP_HEARTWOOD_SLICE`, `COPPER_SLICE`, `UNKNOWN`, and `REVIEW_REQUIRED`.

### Review And Approval

Review/approval is a core ground-truth concept, not an export-only afterthought.

Required artifact states:

- `draft` - work in progress, not ready for review.
- `submitted` - annotator says the artifact is ready for review.
- `approved` - reviewer accepts the artifact for ground-truth use.
- `rejected` - reviewer rejects the artifact, with reason/comment.
- `superseded` - a newer artifact replaces this one while preserving history.

Approved artifacts must remain immutable and exportable by exact version id.

RB-052 implements the first server-enforced workflow for:

- `AnnotationArtifactVersion` where `artifact.kind = SEMANTIC_MASK`,
- `AnnotationArtifactVersion` where `artifact.kind = SLICE_SUPPORT_MASK`,
- `SliceClassificationVersion`.

Implemented transitions are:

- `DRAFT -> SUBMITTED`,
- `SUBMITTED -> APPROVED`,
- `SUBMITTED -> REJECTED`.

`APPROVED`, `REJECTED`, and `SUPERSEDED` are terminal for the current MVP. A newer edit creates a new draft version and does not overwrite approved history. The export-readiness helper uses latest approved versions only.

`ReviewDecision` records:

- reviewed artifact version,
- reviewed slice classification version where applicable,
- status decision,
- reviewedBy,
- reviewedAt,
- comments/reason,
- previous/new state.

The schema allows a review decision to target either an artifact version or a slice classification version; `src/server/domain/review.ts` enforces the exact-one-target invariant.

### Model Predictions And Human Corrections

Model predictions are proposal artifacts, not ground-truth artifacts.

RB-054/RB-056 design decisions:

- mask predictions should start as `AnnotationArtifactKind.PREDICTION_MASK`,
- prediction target type belongs in `PredictionArtifactProvenance.targetType`,
- `ModelRun`, `PredictionRun`, and `PredictionArtifactProvenance` store reproducible model/checkpoint/inference/item provenance,
- `AnnotationTask.predictionRunId` and `AnnotationTask.predictionProvenanceId` are the structured links for future correction tasks,
- `AnnotationTask.sourceArtifactVersionId` remains useful for first correction-task links to mask prediction artifact versions,
- `AnnotationArtifactVersion.parentVersionId` is sufficient for first human mask correction links to source predictions,
- `AnnotationTask.modelSource` is not the reproducible source of truth,
- slice classification predictions should be task/proposal context before a human creates a `SliceClassificationVersion`,
- default training export excludes predictions.

See [model-prediction-contract.md](model-prediction-contract.md) and [active-learning-task-model.md](active-learning-task-model.md).

### ExportBatch And ExportManifest

Owner-created training-data export. RB-053 uses `ExportBatch` and `ExportItem` persistence for a synchronous project-level export workflow with app-mediated manifest and ZIP downloads.

`ExportBatch` records:

- project id,
- target and status,
- manifest format version,
- selection criteria,
- exportedBy and exportedAt,
- manifest storage key and checksum,
- warnings,
- metadata summary with package storage key, package checksum, package size, item count, skipped image count, and warning count.

`ExportItem` records role-specific exact references for included images, semantic mask artifact versions, support mask artifact versions, and slice classification versions.

The RB-053 export generator uses latest approved versions only. It does not export draft, submitted, rejected, superseded, or model-prediction versions as training targets. Semantic segmentation, support segmentation, slice classification, and combined exports remain separate target concepts in the manifest; Copper semantic masks are never used as slice support geometry. RB-060 adds a separate prediction-analysis export for QA. That export references `PredictionArtifactProvenance` and marks predictions as proposals with `groundTruth: false`; it does not change training export eligibility.

RB-055 makes checksum and dimension metadata required for selected export inputs. Readiness exposes missing integrity warnings, and export creation fails with `EXPORT_INTEGRITY_METADATA_MISSING` if selected approved image or mask inputs lack validated checksum/dimensions.

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
- BBox proposal dimensions must be integer `SOURCE_IMAGE_PIXEL` rectangles validated against the source image dimensions.
- Reviewed/approved annotations reference immutable artifact versions.
- Reviewed/approved slice classifications reference immutable `SliceClassificationVersion` rows.
- Export manifests reference exact immutable artifact versions.
- Model predictions never overwrite human ground-truth versions.
- Actor attribution is required for create, edit, review, approval, export, and administrative actions.

## Soft Readiness Invariants

- Missing acquisition metadata may be allowed, but exports must make it visible.
- Missing image-level T-number is visible in the image list and metadata readiness summary, but RB-050 does not hard-block annotation.
- Images without approved annotations may be excluded or flagged in export.
- Copper semantic masks without slice support geometry may be allowed during annotation but should be flagged for instance/support training readiness.
- Sapwood/heartwood semantic masks may be converted to support masks only through explicit documented rules.

## Related Docs

- [annotation-label-schema.md](annotation-label-schema.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [training-export-contract.md](training-export-contract.md)
- [model-prediction-contract.md](model-prediction-contract.md)
- [active-learning-task-model.md](active-learning-task-model.md)
- [prisma-schema-proposal.md](prisma-schema-proposal.md)
- [../01-architecture/domain-boundaries.md](../01-architecture/domain-boundaries.md)
