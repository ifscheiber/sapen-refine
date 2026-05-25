# DESIGN-011 — SaPen Annotate Projects Page Cleanup and Core-Aligned Image Table

## Status

Ready for implementation

## Type

Design / Projects page / Workspace layout cleanup ticket

## Target repository

Work in the `sapen-annotate` repository.

## Reference repository path

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only visual/layout reference. Do not import directly from `../sapen` at runtime unless the repository is intentionally configured for this.

## Background

The current SaPen Annotate Projects page is functionally usable, but still does not fully match the SaPen Core project workspace design.

A first cleanup should align the Projects page with the current SaPen Core Projects page patterns:

- workspace header should communicate the active project clearly
- the local workspace tabs should match the Core workspace/tab design
- the image table/list should look and behave more like the SaPen Core experiment/image tables
- the left sidebar `PROJECTS` section should use the same selected-row style as the new Annotate `IMAGES` section and SaPen Core sidebars
- old bullet-style project rows should be removed

## Important product hierarchy

SaPen Core:

```text
Project → Experiments → Images
```

SaPen Annotate:

```text
Project → Images
```

Therefore, the SaPen Annotate Projects page should not mimic Core’s experiment hierarchy literally.

Instead:

- left sidebar handles project selection
- main workspace shows the active project
- main workspace table/list shows images belonging to the active project
- local tabs switch between active project images/overview and project settings

## Required reference inspection

Codex must first inspect how the Projects page is currently solved in SaPen Core.

Use `../sapen/...` paths.

Inspect at least:

```text
../sapen/apps/sapen-core/src/features/projects/ProjectsOverview.tsx
../sapen/apps/sapen-core/src/features/projects/ProjectsSidebar.tsx
../sapen/apps/sapen-core/src/features/projects/components/ProjectExperimentsCard.tsx
../sapen/apps/sapen-core/src/features/projects/components/ProjectExperimentsTable.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceLayout.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceSidebar.tsx
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/packages/ui/src/styles/theme.css
```

Also inspect the current SaPen Annotate Projects implementation:

```text
src/app/app/projects/page.tsx
src/app/app/projects/[projectId]/page.tsx
src/app/app/projects/[projectId]/images/ui.tsx
src/app/app/AppShell.tsx
src/features/editor
src/lib/projectsClient.ts
```

If paths differ, locate the equivalent files.

## Scope

This ticket is a first design cleanup of the Projects page only.

It may touch:

- Projects page layout
- active project workspace header
- local tabs
- images table/list
- left sidebar `PROJECTS` section styling
- project settings tab shell if it already exists or can be created as a minimal placeholder

It must not touch:

- annotation editor logic
- BBox logic
- semantic/support mask logic
- canvas behavior
- mask storage
- Core handoff contracts
- auth/RBAC backend
- project/image API contracts unless a tiny read-only addition is clearly necessary

## Required changes

### 1. Align Projects page layout with SaPen Core Projects page

The Projects page should look and feel like a SaPen Core workspace.

Codex should inspect the latest SaPen Core implementation and mirror its current structure.

Expected layout pattern:

```text
Topbar / Shell
Left contextual sidebar
Main workspace content
Optional right rail only if useful and already supported
```

The main area should not just say a generic `Projects` title if an active project is selected.

The active project should be clearly visible in the workspace header/context area.

### 2. Workspace header should identify the active project

The main workspace header should make clear which project is open.

Avoid a generic header that only says:

```text
Projects
```

Preferred structure, aligned with SaPen Core:

```text
{Active Project Name}
```

or:

```text
Project Workspace
ACTIVE PROJECT  {projectName}
```

Use the current SaPen Core pattern as reference. If Core now puts the active project name in the header/context row, mirror that.

Suggested metadata/context rows:

```text
WORKSPACE       Project root
ACTIVE PROJECT  {projectName}
IMAGES          {imageCount}
UPDATED         {relativeUpdatedAt}
ROLE            {myRole}
```

Use only data that is already available.

If the active project has no clean display name, use the existing project name/title/id fallback.

### 3. Local workspace tabs

The active project workspace should have local tabs.

Minimum tabs:

```text
Images
Project Settings
```

Depending on current naming, `Project Overview` may be acceptable if it is the tab that contains the image table. But the user-facing structure should be clear:

- one tab for project overview/images
- one tab for project settings

Suggested:

```text
Images
Project Settings
```

Requirements:

- tabs must use the SaPen Core local tab style
- no top-level main tabs inside the workspace
- no unnecessary second navigation row
- active tab indicator should match SaPen Core
- tab content should not cause large vertical spacing waste

### 4. Image table/list overhaul

The current image table/list must be redesigned to match SaPen Core table/card patterns.

Because Annotate has `Project → Images`, the main table should list images of the active project.

Suggested columns:

```text
Preview
Image / Filename
Status
Slices
Mask Versions
Updated
Actions
```

or, if data is unavailable:

```text
Preview
Image / Filename
Slices
Updated
Actions
```

Each row should include:

- image thumbnail/preview if available
- filename
- compact metadata/subtitle
- annotation/status if available
- slice count if available
- mask version count if available
- updated/created timestamp
- primary action: `Open`

Visual requirements:

- follow SaPen Core dense table/card style
- thin borders
- compact rows
- muted secondary text
- no large white/light areas
- preview thumbnails should be modest and aligned
- broken/missing previews should render a dark placeholder
- no horizontal overflow
- long filenames truncate gracefully

Functional requirements:

- clicking row or `Open` navigates to the image editor
- upload flow remains available
- existing image API behavior is preserved

### 5. Project Settings tab

Add or align a local `Project Settings` tab.

If a full settings UI already exists:

- render it there
- style it with SaPen Core workspace components

If no mature settings UI exists:

- provide a minimal read-only settings shell with project metadata
- add TODO/follow-up for editing settings
- do not invent broad backend settings functionality

Suggested minimal content:

```text
Project Settings
Name
Created
Updated
Role
Image count
```

### 6. Left sidebar `PROJECTS` section cleanup

The sidebar `PROJECTS` section should be redesigned using the same design rules as the Annotate editor `IMAGES` section and SaPen Core sidebars.

Current bullet-point style should be removed.

Requirements:

- no bullet points as primary row markers
- active project row has:
  - purple/indigo stripe on the left
  - selected row background tint
  - chevron on the right pointing to the main workspace
- inactive project rows follow SaPen Core sidebar row style
- row title is compact and high contrast
- row subtitle is muted
- long project names truncate
- clicking a project updates active project/main content
- active project remains clearly visible
- section header remains uppercase micro-label style

Suggested project row subtitle:

```text
{imageCount} images · Updated {relativeUpdatedAt}
```

Fallback:

```text
Updated {relativeUpdatedAt}
```

### 7. Sorting projects in sidebar

Use a sensible project sorting strategy.

Preferred order:

1. most recently opened project if tracked
2. otherwise recently updated
3. otherwise created date / stable existing order

The active project should remain visible and selected.

If true `lastOpenedAt` is not available, use `updatedAt` and document the follow-up.

### 8. Empty/loading/error states

Handle cleanly:

- no projects
- project selected but no images
- image previews unavailable
- image list load failure
- project settings unavailable
- no image count available

Empty state examples:

```text
No images in this project yet.
Upload images to start annotation.
```

```text
Projects unavailable.
```

Keep states compact and SaPen Core-like.

## Visual style

Match SaPen Core / current SaPen Annotate dark design:

- dark shell background
- contextual left sidebar
- workspace-style main content
- thin muted borders
- compact spacing
- uppercase micro-labels
- muted blue-gray secondary text
- indigo/violet active states
- amber only for warnings/status issues
- no large marketing cards
- no light generic SaaS table

## Functional boundaries

Do not change:

- image upload API
- image editor routing contract
- annotation/canvas behavior
- BBox/Semantic/Support mask logic
- project/image storage contracts
- auth/RBAC logic
- Core handoff contracts

This is a UI/layout cleanup using existing data and behavior.

## Acceptance criteria

### Workspace layout

- [ ] Projects page visually aligns with current SaPen Core Projects page.
- [ ] Workspace header clearly identifies the active project.
- [ ] Generic-only `Projects` header is replaced or supplemented with active project context.
- [ ] SaPen Core workspace hierarchy is mirrored where practical.

### Tabs

- [ ] Local workspace tabs are present.
- [ ] Minimum tabs: `Images` and `Project Settings`.
- [ ] Tabs use SaPen Core local-tab styling.
- [ ] No unnecessary top-level/main tabs are introduced.

### Image table/list

- [ ] Main content lists images of the active project.
- [ ] Image table/list visually matches SaPen Core table/card style.
- [ ] Rows include preview or safe placeholder.
- [ ] Rows include filename and useful metadata.
- [ ] Open action navigates to image editor.
- [ ] Empty/no-image state is handled.

### Sidebar projects section

- [ ] `PROJECTS` section no longer uses bullet points as row markers.
- [ ] Active project row has purple/indigo left stripe.
- [ ] Active project row has right chevron.
- [ ] Inactive project rows follow SaPen Core sidebar style.
- [ ] Projects are sorted by recently opened if available, otherwise updated/created fallback.
- [ ] Clicking a project updates active project.

### Regression

- [ ] Existing project loading still works.
- [ ] Existing image loading still works.
- [ ] Upload image flow still works.
- [ ] Opening image editor still works.
- [ ] No editor/canvas/mask behavior is changed.
- [ ] Typecheck/lint/build status is reported.

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

1. Open Projects page.
2. Verify active project is clearly shown in workspace header/context.
3. Verify local tabs `Images` and `Project Settings`.
4. Verify `Images` tab lists images of active project.
5. Verify image previews or placeholders render.
6. Click an image row/open action.
7. Verify image editor opens.
8. Switch to another project in left sidebar.
9. Verify main content updates to selected project.
10. Verify active project row has left purple stripe and chevron.
11. Verify project rows no longer use bullet markers.
12. Open Project Settings tab.
13. Verify no editor/canvas/mask regressions.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement DESIGN-011: SaPen Annotate Projects Page Cleanup and Core-Aligned Image Table.

Important:
The SaPen Core reference repository is located at ../sapen relative to the sapen-annotate repository root.
Use ../sapen/... for read-only inspection only.

First inspect the current SaPen Core Projects page implementation:
../sapen/apps/sapen-core/src/features/projects/ProjectsOverview.tsx
../sapen/apps/sapen-core/src/features/projects/ProjectsSidebar.tsx
../sapen/apps/sapen-core/src/features/projects/components/ProjectExperimentsCard.tsx
../sapen/apps/sapen-core/src/features/projects/components/ProjectExperimentsTable.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceLayout.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceSidebar.tsx
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/packages/ui/src/styles/theme.css

Then inspect local sapen-annotate Projects files:
src/app/app/projects/page.tsx
src/app/app/projects/[projectId]/page.tsx
src/app/app/projects/[projectId]/images/ui.tsx
src/app/app/AppShell.tsx
src/lib/projectsClient.ts

Goal:
Perform a first design cleanup of the SaPen Annotate Projects page.

Required:
1. Align layout/design with current SaPen Core Projects page.
2. Make workspace header clearly identify the active project, not just generic “Projects”.
3. Add/adapt local workspace tabs:
   - Images
   - Project Settings
4. Redesign the active project image table/list to match SaPen Core table/card patterns.
5. Main table lists images of the active project, not other projects.
6. Redesign left sidebar PROJECTS section:
   - remove bullet points
   - active row has purple/indigo left stripe
   - active row has right chevron
   - rows match SaPen Core sidebar style
   - sort by recently opened if available, otherwise updated/created fallback

Do not change:
- annotation editor logic
- canvas behavior
- mask/BBox logic
- image upload contracts
- auth/RBAC
- Core handoff contracts
- project/image API contracts unless a tiny read-only addition is clearly needed

Run:
- npm run typecheck
- npm run lint
- npm run build
- npm test if appropriate

Report:
A. What changed
B. Files changed
C. Which SaPen Core Projects/sidebar/table patterns were reused or mirrored
D. How active project header is displayed
E. How image table/list was redesigned
F. How project sidebar sorting/highlight works
G. Validation results
H. Follow-ups
```

## Suggested commit message

```text
Align annotate projects workspace with SaPen Core patterns
```
