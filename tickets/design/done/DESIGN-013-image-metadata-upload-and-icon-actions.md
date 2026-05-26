# DESIGN-013 — Image Metadata at Upload and Icon-Only Image Table Actions

## Status

Done

## Type

Projects page / upload UX / image metadata / table actions ticket

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


## Goal

Move image metadata entry into the `Upload Image` flow and clean up image table actions.

The image table should use icon actions with tooltips instead of text-heavy action buttons.

The historical action label `Crop Workflow` must be renamed/replaced with an annotation-oriented action such as `Annotate` or `Label`.

## Background

Image metadata should be captured when the image is uploaded. If metadata must be added or edited later, the Images table row should provide an edit icon.

The current `Crop Workflow` label is historical and no longer describes the user intent. Users are annotating/labeling images.

## Required reference inspection

Inspect current local upload and image table code:

```text
src/app/app/projects/[projectId]/page.tsx
src/app/app/projects/[projectId]/images/ui.tsx
src/app/app/projects/[projectId]/images
src/lib/projectsClient.ts
src/features
src/components
```

Search for:

```text
Upload image
Upload Images
metadata
Crop Workflow
crop workflow
Open editor
Annotate
Label
tooltip
```

Inspect SaPen Core table/action/icon tooltip patterns:

```text
../sapen/apps/sapen-core/src/features/projects/components/ProjectExperimentsTable.tsx
../sapen/apps/sapen-core/src/features/experiments/preparation/images
../sapen/packages/ui/src/components/ui/tooltip.tsx
../sapen/packages/ui/src/components/ui/button.tsx
../sapen/packages/ui/src/styles/theme.css
```

## Required changes

### 1. Metadata input belongs to upload flow

The `Upload Image` flow should collect image metadata at upload time.

Metadata fields depend on the current product model. Codex must inspect existing metadata schema first.

Possible fields if already supported:

- image name/title
- description
- stain/family/type
- source/acquisition metadata
- tags/notes
- acquisition date
- role/context

Do not invent broad metadata schema if none exists.

If metadata support already exists in API/schema:

- add fields to upload dialog/form
- submit metadata with existing upload commit
- validate minimally
- preserve upload contract

If metadata support does not exist yet:

- add the UI structure only where safe
- or create a small follow-up for backend/schema support
- do not fake persistence

### 2. Metadata editing from Images table

Each Images table row should include an edit metadata icon.

Requirements:

- icon-only button
- tooltip, e.g. `Edit metadata`
- opens existing metadata dialog/editor if present
- if not present, add minimal edit dialog only if existing API supports update
- if update API is missing, show disabled icon with tooltip or document follow-up

### 3. Replace `Crop Workflow`

Rename or replace the historical `Crop Workflow` action.

Preferred visible action:

```text
Annotate
```

Alternative:

```text
Label
```

Recommended implementation:

- icon-only action button in image row
- tooltip: `Annotate image`
- routes to the existing editor/crop workflow route
- preserve the route/functionality, only change label/presentation

Do not keep `Crop Workflow` as user-facing wording unless it appears only in code/internal route names.

### 4. Use icons with tooltips for row actions

General rule for image table row actions:

- Use icon-only buttons with accessible labels and tooltips.
- Avoid icon + text labels in dense tables.
- Provide `aria-label`.
- Use SaPen Core-like button/icon sizing.

Suggested row actions:

- Annotate image
- Edit metadata
- Delete image, if existing and safe
- More actions, if needed

Do not add unused placeholder actions.

## Acceptance criteria

- [ ] Upload flow includes metadata fields if supported by current schema/API.
- [ ] Metadata is persisted during upload if existing contracts support it.
- [ ] Images table has an edit metadata icon with tooltip.
- [ ] `Crop Workflow` is no longer user-facing wording.
- [ ] Annotation action is renamed/presented as `Annotate` or `Label`.
- [ ] Dense table actions use icons with tooltips and accessible labels.
- [ ] Existing upload flow still works.
- [ ] Existing editor route still works.
- [ ] No broad schema/API changes are made unless explicitly safe and documented.

## Validation

Manual smoke checklist:

1. Open Projects page.
2. Start Upload Image.
3. Verify metadata fields appear if supported.
4. Upload an image.
5. Verify metadata persists/displays if supported.
6. Click edit metadata icon in Images table.
7. Verify edit behavior or documented disabled/follow-up state.
8. Click Annotate/Label icon.
9. Verify existing editor opens.

Run:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement DESIGN-013: Image Metadata at Upload and Icon-Only Image Table Actions.

Goals:
1. Image metadata should be entered during Upload Image where supported by current schema/API.
2. Metadata can be edited later through an edit icon in the Images table.
3. Replace user-facing “Crop Workflow” wording with “Annotate” or “Label”.
4. Use icon-only row actions with tooltips and aria-labels.

Inspect current upload/image APIs first. Do not invent a broad metadata schema. If persistence APIs are missing, implement safe UI only where appropriate and document follow-up.

Preserve:
- existing upload/presign/commit behavior
- existing editor route
- existing auth/RBAC
- existing project/image contracts unless a tiny safe metadata addition already fits current API

Run validation and report:
A. metadata fields found/used
B. upload changes
C. table action changes
D. whether metadata edit persists or requires follow-up
E. validation results
```

## Suggested commit message

```text
Move image metadata into upload flow and simplify image actions
```
