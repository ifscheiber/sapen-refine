# Prisma Schema Proposal

## Purpose

This page records the RB-048 proposal and the RB-049 implementation decision. The implemented schema source is `prisma/schema.prisma`; see [prisma.md](prisma.md) for the current persisted model.

## Current-To-Target Mapping

| Current MVP concept | Current source | Target concept | Notes |
| --- | --- | --- | --- |
| `Project` | `prisma/schema.prisma` | `AnnotationProject` | Keep as standalone annotation project; add label schema, metadata defaults, workflow/export settings. |
| `ProjectMember` | `prisma/schema.prisma` | `ProjectMembership` | Extend or preserve with explicit annotate/review/export capabilities. |
| `Image` | `prisma/schema.prisma` | `ImageAsset` | Add checksum, dimensions, validation state, acquisition metadata, sample/specimen links. |
| `Mask` | `prisma/schema.prisma` | Artifact grouping or deprecated compatibility container | Current per-image/per-kind container is too narrow for semantic/support/prediction/review workflows. |
| `MaskVersion` | `prisma/schema.prisma` | `SemanticMaskVersion`, `SupportMaskVersion`, or generic `AnnotationArtifactVersion` | Add label schema version, provenance, review state, coordinate space, source version, task/session links. |
| `MaskKind.PREDICTION` | `prisma/schema.prisma` | `PredictionArtifact` | Prediction is a proposal/input with model provenance, not ground truth. |
| `MaskKind.REFINED` | `prisma/schema.prisma` | Human semantic mask draft/submitted/approved versions | Legacy MVP name; should not be final standalone annotation terminology. |
| `AuditLog` | `prisma/schema.prisma` | Audit events for domain actions | Must cover create/edit/review/approval/export/admin actions consistently. |

## Proposed Model Groups

### Identity And Access

Keep the current local auth foundation:

- `User`
- `Role`
- `UserGlobalRole`
- `Session`

Extend project access with explicit domain capabilities either by enhancing `ProjectRole` semantics or adding policy rows:

- annotate,
- review/approve,
- export,
- administer project.

Default mapping:

- `OWNER`: annotate, review, export, administer.
- `QA`: annotate, review, optional export by project policy.
- `LABELER`: annotate.
- `VIEWER`: read only.

### Project And Image

Proposed models:

- `AnnotationProject`
- `ProjectMember`
- `ImageAsset`
- `ImageAcquisitionMetadata`
- `Sample` or `Specimen`

Important fields:

- project label schema version,
- image storage key/checksum/dimensions/content type/size,
- upload attribution,
- acquisition metadata,
- T-number/sample/specimen/slice metadata,
- archive status instead of destructive deletion for reviewed/exported assets.

### Tasks And Sessions

Proposed models:

- `AnnotationTask`
- `AnnotationSession`

Important fields:

- task type,
- task status,
- assignee,
- priority,
- task reason,
- uncertainty score,
- confidence score,
- model source or prediction source,
- started/committed timestamps,
- actor attribution,
- client/tool version.

These fields keep the model compatible with future active-learning and preprediction queues.

### Labels

Proposed models:

- `LabelSchema`
- `LabelSchemaVersion`
- `LabelDefinition`

Important fields:

- stable machine-readable label id,
- versioned semantic meaning,
- task applicability,
- export mapping,
- display name/color as UI metadata only,
- active/deprecated status.

### Artifacts And Masks

Implementation should choose one of two patterns in RB-049:

- separate concrete tables such as `SemanticMaskVersion`, `SliceSupportMaskVersion`, and `PredictionArtifact`;
- or one generic `AnnotationArtifactVersion` table with strict artifact type, typed metadata, and constraints.

RB-049 chose the generic artifact pattern:

- `AnnotationArtifact` groups one artifact family for an image/kind/scope.
- `AnnotationArtifactVersion` stores immutable artifact versions.
- `AnnotationArtifactKind` distinguishes `SEMANTIC_MASK`, `SLICE_SUPPORT_MASK`, `INSTANCE_MASK`, `PREDICTION_MASK`, and `DERIVED_MASK`.

This keeps semantic/support/prediction semantics explicit without duplicating similar version tables.

Required fields for mask artifacts:

- project id,
- image id,
- task id,
- session id,
- artifact type,
- artifact role: semantic material, support/instance, prediction, derived artifact,
- label schema version id,
- storage key,
- checksum,
- size,
- width and height,
- coordinate space or transform,
- format,
- createdBy and createdAt,
- provenance kind,
- parent/source version,
- review state.

### Slice Instances And Classification

Proposed models:

- `SliceInstance`
- `SliceClassificationVersion`

Important fields:

- image id,
- support mask version id when available,
- bounding box/geometry summary,
- sample/specimen metadata link,
- classification label,
- label schema/class schema version,
- actor attribution,
- review state.

### Review And Approval

Proposed models:

- `ReviewDecision`
- optional `ArtifactStateTransition`

Required states:

- `draft`
- `submitted`
- `approved`
- `rejected`
- `superseded`

Important fields:

- artifact version id,
- prior and new state,
- reviewedBy,
- reviewedAt,
- comments/reason,
- accepted/superseded target version where applicable.

Review decisions must be append-only audit facts. They should not delete or rewrite artifact history.

### Export

Proposed models:

- `ExportBatch`
- `ExportManifest`
- optional `ExportItem`

Important fields:

- export target,
- selection criteria,
- exportedBy,
- exportedAt,
- manifest format version,
- label schema version ids,
- included image ids,
- included artifact version ids,
- artifact storage key,
- checksums,
- warnings/completeness flags.

## Indexes And Constraints

RB-049 should define exact Prisma constraints. Minimum expected constraints:

- unique image storage key,
- unique artifact storage key,
- indexes by project/image/task/status,
- indexes by review state and export inclusion,
- unique label ids within one label schema version,
- immutable references from reviews and exports to exact artifact version ids.

## Deletion And Archive Policy

Development-stage data may be destroyed locally during RB-049 migration work.

Domain policy for the app:

- raw images should not be physically deleted once reviewed or exported,
- approved artifact versions should not be deleted,
- rejected/draft artifacts may be archived but should retain attribution while referenced,
- exports are immutable audit records,
- destructive admin cleanup needs a separate policy ticket before customer data is used.

## Implementation Phasing For RB-049+

### RB-049 - Annotation Domain Schema Implementation

Implemented the database schema baseline for label schemas, metadata, tasks/sessions, artifact versions, review state, and export tables. Because there is no production data, RB-049 resets the development migration baseline. Use `prisma migrate deploy` for trial/server deployment, not `prisma migrate dev`.

### RB-050 - Project/Image/Sample Metadata Workflow

Add API and UI support for required image dimensions/checksums and structured sample/acquisition metadata, including T-number capture.

### RB-051 - Slice Classification And Support-Mask Workflow

Add slice instance/support geometry and slice classification workflows. Keep support geometry separate from copper semantic masks.

### RB-052 - Review/Approval Workflow

Add submit, approve, reject, and supersede flows with server-side authorization and audit records.

### RB-053 - Admin Training Export MVP

Add export batch creation and manifest generation for semantic segmentation, support/instance segmentation, slice classification, and combined exports.

### RB-054 - Model Preprediction / Active-Learning Design

Add prediction artifact and task-queue design details for model source, confidence/uncertainty, priority, and task reason.

### RB-055 - Upload Artifact Validation / Checksum Hardening

Add checksum, dimensions, object metadata verification, and stronger audit events for image and mask artifacts if this is not fully completed in RB-049/RB-050.

## Open Questions For RB-049

- Resolved in RB-049: Prisma uses `AnnotationProject` while public browser URLs still use `/projects` for compatibility.
- Resolved in RB-049: mask artifacts use generic `AnnotationArtifact` and `AnnotationArtifactVersion` tables with strict artifact kinds.
- Resolved in RB-049 baseline: sample/specimen fields start as `SampleMetadata` tied to `ImageAsset`; richer workflow is RB-050.
- Deferred: `QA` export permission policy remains RB-053.

## Related Docs

- [annotation-domain-model.md](annotation-domain-model.md)
- [annotation-label-schema.md](annotation-label-schema.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [training-export-contract.md](training-export-contract.md)
