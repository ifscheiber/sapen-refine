# DESIGN-018 — Remove Upload Images from Projects Sidebar Actions

## Status

Done

## Type

Design / Projects page sidebar cleanup ticket

## Target repository

Work in the `sapen-annotate` repository.

## Background

On the SaPen Annotate Projects page, the left sidebar currently has an `ACTIONS` section. This area is intended for project-level information and project-level actions only.

`Upload Images` does not belong in the left sidebar `ACTIONS` section because image upload is scoped to the active project workspace and should be triggered from the main content area via the existing upload button.

## Goal

Remove `Upload Images` from the Projects page left sidebar `ACTIONS` section.

Image upload must remain available through the project-specific upload button in the main workspace area.

## Required change

In the Projects page left sidebar:

Remove:

```text
Upload Images
```

from:

```text
ACTIONS
```

The `ACTIONS` section should contain only genuine project-level actions.

Acceptable project-level actions may include, if already implemented and useful:

```text
New Project
Project Settings
Project Gallery
```

Do not add placeholder actions.

If, after removing `Upload Images`, there are no useful project-level actions left, the `ACTIONS` section may be removed entirely.

## UX rationale

The left sidebar is reserved for:

- project summary
- project selection
- project-level actions

Uploading images is not a global/project-selection action. It belongs to the active project workspace and should stay close to the image table/list via the existing button.

This avoids duplicate upload entry points and keeps the sidebar aligned with SaPen Core’s contextual-sidebar logic.

## Scope

This ticket is intentionally small.

It may touch:

- Projects page sidebar component
- Projects page layout/component tests
- related snapshots or E2E selectors if they refer to `Upload Images` in the sidebar

It must not touch:

- upload API
- upload dialog behavior
- image table upload button behavior
- project/image data model
- annotation editor
- BBox/semantic/support mask logic
- auth/RBAC

## Acceptance criteria

- [x] `Upload Images` no longer appears in the Projects page left sidebar `ACTIONS` section.
- [x] The active project upload button in the main workspace remains available and functional.
- [x] Sidebar `ACTIONS` contains only project-level actions, or the section is removed if empty.
- [x] No duplicate upload entry point remains in the sidebar.
- [x] Existing upload flow still works.
- [x] Existing project selection still works.
- [x] Typecheck/lint/build status is reported in the implementation handoff.

## Validation

Run repo-appropriate checks from `sapen-annotate`.

At minimum attempt:

```bash
npm run typecheck
npm run lint
npm run build
```

Run tests if relevant and feasible:

```bash
npm test
```

Manual smoke checklist:

1. Open the Projects page.
2. Verify the left sidebar `ACTIONS` section does not show `Upload Images`.
3. Verify project selection in the sidebar still works.
4. Verify the main workspace still shows the project-specific upload button.
5. Click the main workspace upload button.
6. Verify upload dialog/flow still works.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement DESIGN-018: Remove Upload Images from Projects Sidebar Actions.

Goal:
On the Projects page left sidebar, remove the Upload Images action from the ACTIONS section.

Reason:
The left sidebar ACTIONS area is reserved for project-level information/actions only. Uploading images is scoped to the active project and should remain available through the existing upload button in the main workspace/image table area.

Required:
- Remove Upload Images from the left sidebar ACTIONS section.
- Do not remove or break the main workspace upload button.
- If ACTIONS becomes empty or meaningless, remove the section entirely.
- Keep project selection and project summary unchanged.

Do not change:
- upload API
- upload dialog behavior
- image table upload behavior
- project/image data model
- editor/canvas/mask logic
- auth/RBAC

Run:
- npm run typecheck
- npm run lint
- npm run build
- npm test if appropriate

Report:
A. What changed
B. Files changed
C. Confirmation that sidebar Upload Images was removed
D. Confirmation that main workspace upload still works
E. Validation results
```

## Suggested commit message

```text
Remove upload action from projects sidebar
```
