# DESIGN-012–015 Sprint — Annotate Relative Times, Image Metadata, and Editor Tab Simplification

## Status

Done

## Sprint goal

Clean up several cross-cutting UI/UX issues in SaPen Annotate after the Core-aligned shell/editor work:

1. Use the same relative-time semantics as SaPen Core / SaPen Refine wherever Core does so.
2. Move image metadata entry into the Upload Image flow and expose editing from the Images table.
3. Rename/replace the historical `Crop Workflow` action with an annotation/label action using icons with tooltips.
4. Remove unnecessary local editor tabs:
   - `Classification`
   - `Support Mask`
5. Integrate support-mask drawing into the normal annotation workflow via the `Support` label for Cu staining, with validation and clipping rules.

## Sprint tickets

1. `done/DESIGN-012-relative-time-consistency-core-refine.md`
2. `done/DESIGN-013-image-metadata-upload-and-icon-actions.md`
3. `done/DESIGN-014-remove-classification-tab-family-driven-classification.md`
4. `done/DESIGN-015-remove-support-mask-tab-integrate-support-label.md`

## Verified reference note

In the uploaded SaPen repository, SaPen Core has a dedicated relative-time helper at:

```text
../sapen/apps/sapen-core/src/features/projects/utils/relativeTime.ts
```

It is used across Core, including:

```text
../sapen/apps/sapen-core/src/features/projects/ProjectsSidebar.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceLayout.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisSidebar.tsx
../sapen/apps/sapen-core/src/features/experiments/preparation/images/ImagesPreparationView.tsx
```

SaPen Refine also uses relative dates/timestamps in project/API tests and UI surfaces. Codex should verify the current local `sapen-annotate` situation before implementing.

## Repository / path context

Work in the `sapen-annotate` repository.

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only visual/layout/reference material. Do not import directly from `../sapen` at runtime unless the repository is intentionally configured for this.

## General boundary

Preserve existing storage contracts, API contracts, auth/RBAC behavior, editor canvas behavior, mask serialization, and Core handoff contracts unless the ticket explicitly asks for a small local UI-support addition.

Do not port SaPen Core logic wholesale into `sapen-annotate`.
Do not introduce CDN fonts/icons/Tailwind.
Do not add a new component library.
