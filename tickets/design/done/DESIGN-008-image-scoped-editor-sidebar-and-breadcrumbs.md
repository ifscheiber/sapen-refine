# DESIGN-008 — Image-Scoped Editor Sidebar and Breadcrumbs

## Status

Completed

## Type

Design / editor shell / sidebar context ticket

## Target repository

Work in the `sapen-annotate` repository.

## Reference repository path

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only visual/layout reference. Do not import directly from `../sapen` at runtime unless the repo is intentionally configured for this.

## Background

The current Annotation Editor uses a left sidebar that still shows project-level context:

- `PROJECTS SUMMARY`
- project-level `ACTIONS`
- `PROJECTS` list

This is useful on the Projects page, but it is not the right context inside the Annotation Editor.

In the editor, the user is working on an **image**. Therefore the left sidebar must become image-scoped:

- show an `IMAGE SUMMARY`
- show image-specific actions only if useful
- show an `IMAGES` list containing the images of the active image’s project
- highlight the active image using the same SaPen Core sidebar row pattern

The topbar breadcrumbs must also reflect that the user is inside a specific image.

## Goal

Update the Annotation Editor shell so that the sidebar and breadcrumbs are image-scoped and match SaPen Core design patterns.

The editor should communicate:

```text
Project → Image → Editor
```

not merely:

```text
Project → Editor
```

## Required reference inspection

Inspect SaPen Core sidebar/breadcrumb/topbar patterns:

```text
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/apps/sapen-core/src/features/shell/AppShellLayout.tsx
../sapen/apps/sapen-core/src/features/projects/ProjectsSidebar.tsx
../sapen/apps/sapen-core/src/features/experiments/preparation/images/ImagesPreparationSidebar.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceSidebar.tsx
../sapen/apps/sapen-core/src/components/workspace
../sapen/packages/ui/src/styles/theme.css
```

Use these as visual/design references only.

Inspect local SaPen Annotate files:

```text
src/features/editor/CropSemanticEditorPage.tsx
src/features/editor/CropSemanticEditorClient.tsx
src/features/editor/CropEditorSliceNavigatorRailClient.tsx
src/app/app/AppShell.tsx
src/app/app/projects/[projectId]/page.tsx
src/app/app/projects/[projectId]/images/ui.tsx
src/app/app/projects/[projectId]/images/[imageId]
src/lib/projectsClient.ts
```

If paths differ, locate the equivalent files.

## Required changes

### 1. Extend topbar breadcrumbs by image name

The Annotation Editor topbar/breadcrumb trail must include the active image name.

Use the same breadcrumb design/format as SaPen Core.

Example conceptual breadcrumb:

```text
Projects / {projectName} / {imageFilename}
```

or, if the existing topbar only supports compact breadcrumb text:

```text
Projects  /  E2E Large Mask 177...  /  T 6572.JPG
```

Requirements:

- breadcrumb style must match SaPen Core, not local tab styling
- image filename must be visible
- long names should truncate gracefully
- breadcrumb entries should use existing routes where safe:
  - Projects → Projects page
  - Project name → active project/images workspace
  - Image name → current editor/image route
- do not add extra top-level main tabs
- do not consume unnecessary vertical space

### 2. Replace `PROJECTS SUMMARY` with `IMAGE SUMMARY`

In the Annotation Editor sidebar, replace the project-level summary with image-level summary.

Suggested section:

```text
IMAGE SUMMARY
Active        {image filename}
Project       {project name}
Slices        {slice count}
Open reviews  {open review count}
Export        {ready/not ready}
```

Use only data that is actually available.

If some fields are not available without backend expansion, use safe omissions or existing values only. Do not create heavy backend work in this ticket.

Potential useful rows:

- `Active` — active image filename
- `Project` — parent project name
- `Slices` — slice count
- `Current` — current/valid slice count if available
- `Open reviews` — if modeled; otherwise omit or show `0` only if existing logic already does
- `Export` — ready/not ready if available
- `Mode` — current editor mode if useful

Do not keep project-level summary rows such as:

```text
Projects
Images
```

unless they are directly useful in the image context.

### 3. Re-evaluate `ACTIONS` section for image context

The current `ACTIONS` section contains project-level actions:

- `New Project`
- `Upload Images`
- `Project Gallery`

These are not useful inside the focused image editor.

Replace with useful image-specific actions only.

Possible image actions:

```text
Back to Project Images
Open BBoxes
Open Semantic Masks
Open Support Mask
Export readiness
```

or:

```text
Upload another image
Back to image list
```

However, do not add actions just to fill the section.

If there are no genuinely useful image-scoped actions, remove the `ACTIONS` section entirely from the editor sidebar.

Important:

- Do not duplicate controls that already exist in the editor tabs/toolbar.
- Do not add noisy sidebar actions.
- Keep editor focus on the canvas.

### 4. Replace `PROJECTS` section with `IMAGES`

The editor sidebar must list images from the project that the active image belongs to.

Replace:

```text
PROJECTS
- project A
- project B
```

with:

```text
IMAGES
- T 6572.JPG
  7 slices · Updated 1 min ago
- T 6574.JPG
  4 slices · Updated 12 min ago
- ...
```

Requirements:

- list only images belonging to the active image’s project
- active image row must use the same SaPen Core sidebar selected-row pattern:
  - subtle purple/indigo stripe on the left
  - active row background tint
  - chevron on the right pointing toward the main working area
- non-active image rows use muted dot/marker style like SaPen Core sidebar rows
- clicking an image navigates to that image’s editor
- row subtitle should be compact and useful:
  - `{slice count} slices · Updated {relative time}`
  - or `{status} · Updated {relative time}`
  - or `{mask versions} masks · Updated {relative time}` if available
- long image names should truncate cleanly
- no horizontal overflow

### 5. Sorting: recently opened images first

The `IMAGES` section must be sorted by most recently opened first.

Expected behavior:

- The active/current image appears at or near the top because it was just opened.
- Other images are ordered by their most recent editor open/access time if available.

If the app does not currently persist “last opened” per image:

- Use existing `updatedAt` or last activity timestamp as a fallback.
- Do not add a large backend feature unless trivial.
- Add a TODO/follow-up note for true `lastOpenedAt` tracking.
- Still make the active image visible and selected.

Recommended fallback priority:

1. `lastOpenedAt` if already available
2. `lastEditorOpenedAt` if already available
3. `updatedAt`
4. `createdAt`
5. filename/order fallback

### 6. Match SaPen Core sidebar row design

The `IMAGES` section should reuse or mirror the same display logic as SaPen Core sidebars.

Important visual details:

- active row has left purple/indigo stripe
- active row has stronger background
- active row has chevron on the right
- row title is compact and high contrast
- row subtitle is muted
- inactive rows avoid decorative dot/marker bullets after the final sidebar polish request
- section titles use uppercase micro-labels with letter spacing
- section spacing and dividers follow SaPen Core

Do not invent a new image list style if the Core sidebar pattern can be mirrored.

## Functional boundaries

Do not change:

- annotation canvas logic
- mask serialization/deserialization
- BBox logic
- semantic/support mask editing logic
- commit/autosave contracts
- Core handoff contracts
- auth/RBAC
- project/image API contracts unless a small read-only addition is clearly necessary

Do not add:

- heavy activity tracking backend unless explicitly required
- new component library
- CDN icons/fonts/Tailwind
- fake image data in production code

## Empty/loading/error states

Handle:

- project with only one image
- missing image filename
- failed image list load
- no available slice counts
- long image names
- active image not found in image list

Suggested fallback behavior:

- if image list fails, show compact sidebar message: `Images unavailable`
- if only one image exists, still show it selected under `IMAGES`
- if counts unavailable, omit counts rather than showing fake data

## Acceptance criteria

### Breadcrumbs

- [x] Topbar breadcrumbs include the active image name.
- [x] Breadcrumb styling matches SaPen Core, not local tab style.
- [x] Long image/project names truncate gracefully.
- [x] Existing routes remain intact.

### Sidebar summary

- [x] Editor sidebar uses `IMAGE SUMMARY`, not `PROJECTS SUMMARY`.
- [x] Summary rows are image-relevant.
- [x] Project-level summary rows are removed from the editor sidebar.

### Actions

- [x] Project-level actions are removed from the editor sidebar.
- [x] Image-scoped actions are present only if genuinely useful.
- [x] `ACTIONS` section is removed if no useful image actions exist.

### Images list

- [x] Sidebar section is `IMAGES`, not `PROJECTS`.
- [x] It lists images from the active image’s project.
- [x] Active image row has purple/indigo left stripe.
- [x] Active image row has right chevron.
- [x] Inactive image rows match SaPen Core sidebar row style without decorative bullet markers.
- [x] Clicking another image opens/navigates to that image editor.
- [x] Images are sorted by most-recently-opened first where available, otherwise by safe fallback.
- [x] Active image remains clearly visible and selected.

### Regression

- [x] Editor canvas still loads.
- [x] BBox/Semantic/Support tabs still work.
- [x] No mask/BBox/storage behavior is changed.
- [x] Typecheck/lint/build status is reported.

## Implementation notes

- Added a route-aware shell context for annotation editor image routes only.
- Topbar breadcrumbs now render `Projects / project / image` for editor routes while project and image metadata pages remain project-scoped.
- The editor sidebar now renders `IMAGE SUMMARY`, `Back to Project Images`, and an `IMAGES` list for the active project.
- The image list pins the active image first, then sorts by `updatedAt`/`createdAt`; true per-user last-opened tracking is deferred in the remediation backlog.
- `GET /api/projects/[projectId]/images` gained additive `sliceCount`; no existing image response fields were renamed or removed.
- The final sidebar polish removed decorative bullet/status markers from the `IMAGES` rows.

## Validation

Completed validation:

```bash
npm run typecheck
npm run lint
npx vitest run tests/unit/app-shell-context.test.ts
npm run build
PLAYWRIGHT_PORT=3101 npx playwright test tests/e2e/slice-bbox-proposals.spec.ts
npm run test
npm run check:design-hardcoding
npm run check:docs-links
git diff --check
```

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

1. Open an image editor.
2. Verify breadcrumbs include project and image name.
3. Verify sidebar shows `IMAGE SUMMARY`.
4. Verify sidebar no longer shows `PROJECTS SUMMARY`.
5. Verify project-level actions are gone or replaced with useful image-scoped actions.
6. Verify `IMAGES` section lists images of the active project.
7. Verify active image is highlighted with purple/indigo stripe and right chevron.
8. Click another image in sidebar.
9. Verify navigation opens the selected image editor.
10. Verify active row updates.
11. Verify images sort by last opened if supported, otherwise documented fallback.
12. Verify editor canvas and tabs still work.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement DESIGN-008: Image-Scoped Editor Sidebar and Breadcrumbs.

Current problem:
Inside the Annotation Editor, the sidebar still shows project-level context:
- PROJECTS SUMMARY
- project-level ACTIONS
- PROJECTS list

But the user is editing an image. The editor sidebar must be image-scoped.

Reference:
Use ../sapen as read-only reference for SaPen Core topbar/breadcrumb/sidebar patterns.
Inspect:
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/apps/sapen-core/src/features/projects/ProjectsSidebar.tsx
../sapen/apps/sapen-core/src/features/experiments/preparation/images/ImagesPreparationSidebar.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceSidebar.tsx

Required changes:
1. Extend topbar breadcrumbs with active image name using the same format/design as SaPen Core.
2. Replace PROJECTS SUMMARY with IMAGE SUMMARY.
3. Replace project-level ACTIONS with useful image actions, or remove ACTIONS if there are no genuinely useful image-scoped actions.
4. Replace PROJECTS section with IMAGES section.
5. IMAGES section must list images of the active image’s project.
6. Active image row must use the SaPen Core selected sidebar row pattern:
   - purple/indigo stripe on left
   - selected row background
   - chevron on right
7. Inactive image rows must follow SaPen Core sidebar row style.
8. Sort images by most recently opened first if data exists; otherwise use updatedAt/createdAt fallback and document the limitation.

Do not change:
- canvas logic
- BBox logic
- mask semantics/storage
- commit/autosave contracts
- Core handoff contracts
- auth/RBAC
- API contracts unless a tiny read-only addition is clearly needed

Run:
- npm run typecheck
- npm run lint
- npm run build
- npm test if appropriate

Report:
A. What changed
B. Files changed
C. Which SaPen Core sidebar/breadcrumb patterns were reused/mirrored
D. How image sorting is implemented or what fallback is used
E. Confirmation that active image highlight matches Core pattern
F. Validation results
G. Follow-ups, especially if true lastOpenedAt tracking is missing
```

## Suggested commit message

```text
Scope editor sidebar to active image context
```
