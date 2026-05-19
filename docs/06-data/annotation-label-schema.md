# Annotation Label Schema

## Purpose

This page defines the planned label-schema rules for SaPen Annotate. Current code labels live in `src/mask/labels.ts`; persisted label schemas are not implemented yet.

## Source Of Truth

Stable machine-readable label ids and versioned semantic meanings are the source of truth.

Display names, colors, ordering, and UI grouping are presentation metadata. They must not define training semantics.

## Planned Label Schema Version

A label schema version should define:

- schema id,
- semantic version or monotonically increasing version,
- status such as draft, active, deprecated, or archived,
- createdBy and createdAt,
- stable label ids,
- semantic meaning for each label id,
- task applicability,
- export mapping,
- UI display metadata.

Mask versions and export manifests must reference the exact label schema version used.

## Stable Label IDs

Label IDs must be machine-readable and stable across display changes.

Recommended pattern:

- `background`
- `unknown`
- `sapwood`
- `heartwood`
- `copper`
- `slice_support`
- `slice_class.sap_heartwood_slice`
- `slice_class.copper_slice`
- `slice_class.review_required`

Numeric byte values may still exist inside a compact mask artifact, but they must be resolved through a label schema version in the database/export manifest.

## Versioned Semantic Meanings

Any change that affects training meaning requires a new label schema version.

Examples:

- changing whether `unknown` is trainable or ignored,
- splitting a label,
- merging labels,
- changing whether a copper label means visual copper staining or chemically confirmed copper region,
- changing support-mask semantics.

Examples that do not require a new semantic version by themselves:

- display name wording,
- UI color,
- palette ordering,
- translated label text.

## Task Applicability

Labels must declare where they may be used:

- semantic material masks,
- slice support/instance masks,
- slice classification,
- review flags,
- export-only derived classes.

Copper-specific rule:

The `copper` semantic material label applies to semantic material masks only. It does not define physical slice support geometry.

## MVP Compatibility

Current MVP labels in `src/mask/labels.ts` map to the future schema as follows:

| Current constant | Current byte | Planned stable id | Planned meaning |
| --- | ---: | --- | --- |
| `Labels.BG` | 0 | `background` | Non-annotated/background pixel for a semantic mask. |
| `Labels.SAPWOOD` | 1 | `sapwood` | Sapwood material region. |
| `Labels.HEARTWOOD` | 2 | `heartwood` | Heartwood material region. |
| `Labels.COPPER` | 3 | `copper` | Copper-stained/penetrated material region, not slice support geometry. |
| `Labels.SLICE_SUPPORT` | 10 | `slice_support` | Physical slice support geometry for support-mask artifacts only. |

After RB-051, the browser editor has separate semantic and support label sets. The support-mask UI is binary, but the stored support byte value follows the active label schema definition for `slice_support`; it is not inferred from the Copper semantic label.

## Export Requirements

Every export manifest must include:

- label schema id and version,
- full label definitions used by included artifacts,
- byte-value mapping for each mask artifact format,
- ignored/unknown handling,
- task applicability,
- compatibility notes for deprecated labels.

## Related Docs

- [annotation-domain-model.md](annotation-domain-model.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [training-export-contract.md](training-export-contract.md)
