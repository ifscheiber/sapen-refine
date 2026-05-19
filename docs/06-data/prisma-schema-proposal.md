# Prisma Schema Proposal

## Purpose

This page proposes the future Prisma domain model for SaPen Annotate. It is design documentation only. RB-048 does not edit `prisma/schema.prisma` and does not add a migration.

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

The proposal favors separate conceptual names in docs and allows RB-049 to choose the Prisma shape that keeps constraints clear.

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

Implement the database schema baseline for label schemas, metadata, tasks/sessions, artifact versions, review state, and export tables. Because there is no production data, reset the development migration baseline if that is the cleanest path. Use `prisma migrate deploy` for trial/server deployment, not `prisma migrate dev`.

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

- Should `Project` be renamed in Prisma to `AnnotationProject`, or kept as `Project` with explicit docs/API naming?
- Should mask artifacts use separate concrete tables or a generic typed artifact table?
- Should sample/specimen metadata be normalized into first-class rows immediately or start as structured JSON with validation?
- Should `QA` have export permission by default or require project policy?

## Related Docs

- [annotation-domain-model.md](annotation-domain-model.md)
- [annotation-label-schema.md](annotation-label-schema.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [training-export-contract.md](training-export-contract.md)
