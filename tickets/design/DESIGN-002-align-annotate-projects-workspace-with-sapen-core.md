# DESIGN-002 — Align SaPen Annotate Authenticated Shell and Active-Project Image Workspace with SaPen Core

## Status

Ready for implementation

## Type

Design / UI architecture / AppShell alignment ticket

## Target repository

Work in the `sapen-annotate` repository.

Important path context for Codex:

- Codex will be started from the `sapen-annotate` repository.
- The SaPen Core reference repository is located one directory up and then in `sapen`.
- Therefore, paths into the SaPen repository must be referenced as:

```text
../sapen/...
```

Examples:

```text
../sapen/apps/sapen-core/src/features/shell/AppShellLayout.tsx
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/apps/sapen-core/src/features/shell/AppSidebar.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceLayout.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceSidebar.tsx
../sapen/apps/sapen-core/src/features/projects/ProjectsSidebar.tsx
../sapen/apps/sapen-core/src/features/projects/ProjectsOverview.tsx
```

Do **not** assume that `apps/sapen-core/...` exists inside `sapen-annotate`.

## Goal

Redesign the authenticated SaPen Annotate shell and Projects page so that they follow the established SaPen Core AppShell and Workspace UI patterns.

The SaPen Annotate Projects page must become an **active-project image workspace**, not a generic project directory.

## Product hierarchy

SaPen Core uses:

```text
Project → Experiments → Images
```

SaPen Annotate uses:

```text
Project → Images
```

Therefore:

- Project creation and project selection belong in the **left contextual sidebar**.
- The main content area must show only the **currently selected active project**.
- The main table/list must show the **images belonging to that active project**.
- The main content area must **not** list other projects as rows/cards.

## Background

A first login redesign has established a dark SaPen Annotate visual direction aligned with SaPen Core. The authenticated Projects page now needs the same product-family alignment.

The user uploaded the full current SaPen repository as reference. The look and feel of SaPen Annotate should be derived from existing SaPen Core AppShell and workspace patterns rather than invented from scratch.

The previous design direction using a generic left navigation sidebar (`Projects`, `Core Handoffs`, `Annotation Library`, `Review Queue`, `Settings`) is no longer preferred for the Projects page. SaPen Annotate should instead follow the SaPen Core contextual sidebar pattern.

## Required reference inspection

From the `sapen-annotate` repository, inspect the SaPen Core reference files using `../sapen/...` paths.

### SaPen Core shell/workspace references

Inspect at least:

```text
../sapen/apps/sapen-core/src/features/shell/AppShellLayout.tsx
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/apps/sapen-core/src/features/shell/AppSidebar.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceLayout.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceSidebar.tsx
../sapen/apps/sapen-core/src/features/projects/ProjectsSidebar.tsx
../sapen/apps/sapen-core/src/features/projects/ProjectsOverview.tsx
../sapen/apps/sapen-core/src/features/projects/components/ProjectExperimentsCard.tsx
../sapen/apps/sapen-core/src/features/projects/components/ProjectExperimentsTable.tsx
../sapen/apps/sapen-core/src/features/experiments/preparation/images/ImagesPreparationSidebar.tsx
```

Also inspect shared UI/theme files if present and relevant:

```text
../sapen/packages/ui
../sapen/packages/ui/src
../sapen/packages/ui/src/styles
```

### SaPen Annotate local files

Inspect current local files in `sapen-annotate`, especially:

```text
src/app/app/AppShell.tsx
src/components/TabSidebar.tsx
src/components/ProjectLibrary.tsx
src/app/app/projects/page.tsx
src/app/app/projects/[projectId]/page.tsx
src/app/app/projects/[projectId]/images/ui.tsx
src/lib/projectsClient.ts
```

If the paths differ, locate equivalent files before implementing.

## Design-system rule

Do **not** invent a new shell or visual system.

Reuse or closely mirror the SaPen Core look and feel:

- dark shell
- compact top bar
- contextual left sidebar
- workspace page hierarchy
- local tabs
- context/meta rows
- subtle right utility rail where useful
- thin borders
- dense technical layout
- muted secondary text
- indigo/violet active and primary states
- amber only for warnings or review-required states

Prefer existing semantic tokens and shared UI variables from SaPen Core / `@sapen/ui` where available.

Relevant variables/patterns may include:

```text
--app-background
--shell-topbar-bg
--shell-sidebar-bg
--workspace-background
--border-subtle
--accent-primary
--text-primary
--text-secondary
--text-muted
```

If these primitives are not directly importable into `sapen-annotate`, decide the safest implementation path:

1. Prefer reuse from shared packages if already available.
2. If reasonable and low-risk, extract stable shared workspace primitives into a shared UI package.
3. Otherwise create a small `sapen-annotate` local mirror that matches the SaPen Core API/style closely and document extraction to shared UI as a follow-up.

Avoid large refactors.

## Target shell

### Top bar

Follow SaPen Core visual structure:

- compact height
- dark background
- subtle bottom border
- left side:
  - SaPen / SaPen Annotate logo or temporary logo mark
  - `SaPen Annotate`
- top-level navigation may include:
  - `Projects`
  - `Quick Analysis`
  - other entries only if currently meaningful
- right side:
  - compact authenticated icons only if functional or already present
  - account/user menu if existing
- no public/demo credential hints

### Left contextual sidebar

The sidebar must follow the SaPen Core contextual pattern.

It should **not** be a generic module menu.

Required sections:

```text
PROJECTS SUMMARY
```

Suggested rows:

- `Active` — selected project name or `—`
- `Projects` — number of visible annotation projects
- `Images` — number of images in the active project
- `Open reviews` — number if available; otherwise `0` or omit if unavailable

```text
ACTIONS
```

Suggested actions:

- `New Project`
- `Upload Images`
- `Project Gallery`

Optional action if supported:

- `Open Core Handoff`

```text
PROJECTS
```

- list visible annotation projects
- active project highlighted with the same subtle indigo left-border/background pattern used in SaPen Core
- each row shows:
  - project name
  - subtitle such as `24 images · Updated 1 min ago`
- selecting a project updates the active project and main content
- project creation happens here or via an action in this sidebar

### Main workspace area

The main area shows the **active project only**.

It should follow the SaPen Core page hierarchy:

#### Top tabs

```text
Projects
Quick Analysis
```

#### Page header

Title:

```text
Projects
```

Metadata line:

```text
WORKSPACE  Project root  ·  VISIBLE PROJECTS  {count}
```

#### Active project context row

Show a compact context row similar to SaPen Core:

```text
ACTIVE PROJECT  {selectedProject.name}
OWNER           {owner or —}
ROLE            {myRole or —}
UPDATED         {relative updatedAt}
ACTIONS         Manage …
```

#### Local tabs

Use local tabs for the active project:

```text
Images
Project Settings
```

The `Images` tab is the primary tab.

## Main Images tab

The `Images` tab must show images belonging to the selected active project.

Do **not** show a list/table of projects here.

### Image list/table columns

Suggested columns:

```text
Preview
Image / Filename
Status
Mask Versions
Updated
Actions
```

Each row should include:

- thumbnail/preview image
- filename
- optional content type / size if already available
- annotation status if available
- mask version count if available
- created/updated timestamp
- action: `Open editor`

### Image preview behavior

Use existing project/image APIs and utilities where available, for example:

```text
apiListImages(projectId)
apiGetImageViewUrl(projectId, imageId)
existing /api/projects/[projectId]/images routes
existing image view URLs
```

If thumbnails are not separately available:

- use the image view URL as the preview source
- render a dark technical placeholder if no preview URL is available
- gracefully handle broken image loads
- do not let broken previews break the table

### Missing data handling

If status or mask version counts are not available from existing APIs:

- do not perform a large backend expansion in this ticket unless trivial and clearly safe
- show safe defaults or omit the column
- add TODOs/follow-up notes
- preserve existing API contracts where possible

Examples:

```text
Not annotated
In progress
Review required
Completed
```

If those states are not actually modeled yet, use existing status fields only.

## Right utility rail

If useful and low-risk, add a right-side rail following the SaPen Core pattern.

Suggested sections:

```text
INVITATIONS
No pending invites
```

```text
RECENT ACTIVITY
Handoff received
Mask version committed
Review state changed
Project created
```

Important:

- Do not create fake production data.
- Use real data if available.
- Otherwise show subtle empty states or omit the rail.

## Actions and routing

Preserve existing behavior.

- `New Project` uses existing project creation flow.
- `Upload Images` uses existing upload/presign/commit flow.
- `Open editor` routes to the existing image editor route.
- `Project Gallery` uses existing gallery/project selection route if present.
- `Manage …` uses existing project management/settings route if present.

Do not change authentication or RBAC contracts.

## Current anti-patterns to remove or replace

Replace or avoid:

- old light/gray Project page styling
- generic app navigation sidebar as the main sidebar
- `TabSidebar` styling that conflicts with SaPen Core shell
- project cards/list in the main content area
- image list without visual previews
- purely numeric image rows without thumbnails
- standalone Stitch HTML or CDN-based styling

## Explicit non-goals

Do **not** touch unless absolutely necessary for compile/import fixes:

- annotation canvas drawing logic
- mask serialization/deserialization
- mask overlay rendering
- autosave behavior
- Core handoff contracts
- existing auth provider contracts
- backend data model beyond trivial read-only additions
- logo design
- full SaPen Annotate redesign outside the authenticated shell/projects workspace

## Visual acceptance criteria

- SaPen Annotate authenticated shell clearly belongs to the same product family as SaPen Core.
- Left sidebar follows the SaPen Core contextual section pattern.
- Active project selection happens in the left sidebar.
- Main content shows the active project only.
- Images of the active project are visible in the main section.
- Image rows include thumbnails/previews or robust placeholders.
- Styling is dark, compact, technical, and SaPen-like.
- Borders, spacing, typography, and active states match SaPen Core as closely as practical.
- No generic annotation SaaS dashboard feel.

## Functional acceptance criteria

- Existing login/authenticated access still works.
- Existing project list retrieval still works.
- Selecting a project updates the active project.
- Upload image flow still works.
- Opening an image in the editor still works.
- Existing API contracts are preserved unless explicitly justified.
- Empty project and empty image states are handled.
- Broken/missing image previews are handled gracefully.
- No demo credentials are shown.
- No CDN font/icon/Tailwind dependencies are introduced.

## Validation

Inspect local `package.json` in `sapen-annotate` and run the appropriate commands.

At minimum attempt:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If the repository uses different scripts, use the correct ones.

Also run grep-style checks for:

```text
Demo Credentials
admin1234
admin@sapen.local
cdn.tailwindcss.com
fonts.googleapis.com
Material Symbols
```

If any validation command cannot be run, document why.

## Deliverables

Codex should provide:

1. Implementation summary
2. Files changed
3. Explanation of which SaPen Core patterns/components were reused, extracted, or mirrored
4. Confirmation that project selection is in the sidebar and active project images are in main content
5. Validation commands and results
6. Remaining limitations / follow-up tickets

## Suggested commit message

```text
Align annotate projects workspace with SaPen Core shell
```

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Important:
The SaPen Core reference repository is located at ../sapen relative to the sapen-annotate repository root.
When inspecting SaPen Core files, use paths like ../sapen/apps/sapen-core/...
Do not assume apps/sapen-core exists inside sapen-annotate.

Implement DESIGN-002: Align SaPen Annotate Authenticated Shell and Active-Project Image Workspace with SaPen Core.

Product hierarchy:
SaPen Core: Project → Experiments → Images
SaPen Annotate: Project → Images

Therefore:
- project creation and project selection must be in the left contextual sidebar
- the main section must show only the active selected project
- the main Images tab/table must list images of the active project
- do not list other projects in the main content area

First inspect the SaPen Core reference patterns:
../sapen/apps/sapen-core/src/features/shell/AppShellLayout.tsx
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/apps/sapen-core/src/features/shell/AppSidebar.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceLayout.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceSidebar.tsx
../sapen/apps/sapen-core/src/features/projects/ProjectsSidebar.tsx
../sapen/apps/sapen-core/src/features/projects/ProjectsOverview.tsx
../sapen/apps/sapen-core/src/features/projects/components/ProjectExperimentsCard.tsx
../sapen/apps/sapen-core/src/features/projects/components/ProjectExperimentsTable.tsx
../sapen/apps/sapen-core/src/features/experiments/preparation/images/ImagesPreparationSidebar.tsx

Then inspect the local sapen-annotate files:
src/app/app/AppShell.tsx
src/components/TabSidebar.tsx
src/components/ProjectLibrary.tsx
src/app/app/projects/page.tsx
src/app/app/projects/[projectId]/page.tsx
src/app/app/projects/[projectId]/images/ui.tsx
src/lib/projectsClient.ts

If paths differ, locate equivalent files.

Reuse or closely mirror SaPen Core shell/workspace patterns. Do not invent a new shell. Do not paste Stitch HTML. Do not use CDN fonts/icons/Tailwind. Do not add a new component library.

Target:
- compact SaPen Core-like top bar
- contextual left sidebar with PROJECTS SUMMARY, ACTIONS, PROJECTS
- main workspace page with Projects / Quick Analysis top tabs
- page header and active project context row
- local tabs: Images / Project Settings
- Images tab shows active project images with previews/thumbnails
- optional right rail for activity/invitations if real data or safe empty state exists

Use existing image APIs:
apiListImages(projectId)
apiGetImageViewUrl(projectId, imageId)
or equivalent current routes/utilities.

Each image row should show:
- preview/thumbnail or placeholder
- filename
- status if available
- mask version count if available
- updated/created timestamp
- Open editor action

Preserve:
- auth behavior
- RBAC behavior
- project creation flow
- upload flow
- open editor route
- existing API contracts where possible

Do not touch:
- AnnotationCanvas drawing logic
- mask serialization/deserialization
- mask overlay rendering
- autosave behavior
- Core handoff contracts
unless a compile error forces a trivial import/type fix.

Run appropriate validation:
- typecheck
- lint
- relevant tests
- build if feasible

Run grep checks for:
Demo Credentials
admin1234
admin@sapen.local
cdn.tailwindcss.com
fonts.googleapis.com
Material Symbols

Deliver a concise report:
A. What changed
B. Files changed
C. SaPen Core patterns reused/extracted/mirrored
D. Confirmation of sidebar project selection and main active-project image table
E. Validation commands/results
F. Limitations/follow-ups

If repository rules allow commits, create one focused commit:
Align annotate projects workspace with SaPen Core shell
```
