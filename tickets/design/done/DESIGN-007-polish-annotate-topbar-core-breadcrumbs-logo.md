# DESIGN-007 — Fix Annotate Topbar Breadcrumbs, Remove Redundant Main Tabs, and Match SaPen Core Logo Sizing

## Status

Completed

## Implementation notes

- Inspected the SaPen Core topbar, shell layout, theme, and logo asset references under `../sapen` as read-only design inputs.
- Replaced the SaPen Annotate underlined `Projects` topbar item with quiet Core-style breadcrumb navigation in `src/components/shell/AppTopbar.tsx`.
- Matched the topbar logo render box to the Core `132x30` asset sizing and preserved aspect ratio with `object-contain`.
- Removed the redundant Projects workspace `WorkspaceTopTabs` row from `src/features/projects/ProjectsWorkspacePage.tsx`.
- Preserved existing auth, logout, project routes, sidebar, editor, canvas, mask, BBox, and API behavior.
- Updated app-shell and theming documentation to record the finalized breadcrumb/logo/top-tab behavior.

## Type

Design / AppShell polish ticket

## Target repository

Work in the `sapen-annotate` repository.

## Reference repository path

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only reference. Do not import directly from `../sapen` at runtime unless the repo is intentionally configured for this.

## Background

A first pass aligned the SaPen Annotate topbar with the SaPen Core shell, but the current result still differs from the SaPen Core design in three important ways:

1. Breadcrumbs / top navigation currently look like tab navigation with an underline.
2. SaPen Annotate currently shows additional main tabs that are not needed.
3. The SaPen logo is far too large compared with the SaPen Core topbar.

This ticket corrects only the authenticated topbar / page-header shell area.

## Goal

Make the SaPen Annotate topbar/page-header area match the SaPen Core design more closely:

- Breadcrumbs/navigation should look like SaPen Core breadcrumbs, not like active tabs.
- Remove unnecessary main tabs in SaPen Annotate.
- Reduce the logo size to match SaPen Core exactly or as closely as possible.
- Save vertical space by removing the unnecessary second topbar/tab row.
- Preserve all existing routing/auth/logout behavior.

## Required reference inspection

Inspect the SaPen Core topbar implementation and styling:

```text
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/apps/sapen-core/src/features/shell/AppShellLayout.tsx
../sapen/packages/ui/src/styles/theme.css
../sapen/packages/assets/src/index.ts
../sapen/packages/assets/src/sapen-logo-grey.svg
../sapen/packages/assets/src/sapen-logo-white.svg
```

Also inspect the current local SaPen Annotate implementation:

```text
src/app/app/AppShell.tsx
src/features/shell
src/components
src/app/app/projects/page.tsx
src/app/app/projects/[projectId]/page.tsx
```

If paths differ, locate the equivalent files.

## Required changes

### 1. Breadcrumbs must match SaPen Core design

The current SaPen Annotate topbar makes `Projects` look like a tab with a strong underline.

This should be changed.

The SaPen Core topbar uses a quieter breadcrumb/navigation treatment. SaPen Annotate should follow that pattern exactly or as closely as possible.

Expected behavior:

- `Projects` should appear as breadcrumb/topbar navigation text in the same style as SaPen Core.
- It should not use the local-tab underline style.
- If an active state is needed, it must use the same subtle Core treatment.
- Do not reuse editor/local-tab styling for topbar breadcrumbs.

Important distinction:

- Topbar breadcrumbs/navigation are not local page tabs.
- Local tabs may still exist inside the workspace/editor content where needed, e.g. `BBoxes`, `Semantic Masks`, `Support Mask`.
- The topbar should not visually behave like those local tabs.

### 2. Remove unnecessary SaPen Annotate main tabs

SaPen Annotate does not need additional top-level main tabs here.

Do not show extra top-level tabs such as:

```text
Projects
Quick Analysis
Datasets
Workflows
```

unless they are truly required and implemented.

For the current SaPen Annotate authenticated shell:

- Remove the extra second-row / main-tab structure.
- Keep only the minimal Core-style breadcrumb/navigation needed to show the current area, e.g. `Projects`.
- Do not add placeholder navigation entries.
- Do not create a second navigation row just to mirror SaPen Core if Annotate does not need it.

Reason:

- SaPen Annotate currently does not need a distinction between `Projects` and `Quick Analysis` in the topbar.
- Removing the extra row saves vertical space, which is important for editor usability.
- If future modules are added, top-level navigation can be reintroduced later.

### 3. Logo size must match SaPen Core

The current SaPen Annotate logo is much too large.

Required:

- Use the same logo asset sizing as SaPen Core, if possible.
- If using the same SVG asset, use the same `height`, `width`, max-height, and object-fit pattern as the Core `AppTopBar`.
- Do not allow the logo to increase the topbar height.
- Do not use oversized arbitrary classes.
- The logo should be visually identical in size to SaPen Core or slightly smaller, never larger.

Approximate guidance if exact Core classes cannot be reused:

- logo mark/text combined should fit comfortably inside the compact topbar
- cap logo image height to approximately `28px–32px`, unless Core uses a different explicit value
- keep `width: auto`
- align vertically center
- preserve aspect ratio

If the Core topbar uses a specific class or asset wrapper, mirror that rather than inventing a new size.

### 4. Preserve right-side actions

Keep existing right-side authenticated actions, but preserve the Core-like visual style.

Expected:

- compact account/logout area
- no oversized icons
- no new placeholder icons
- existing logout behavior still works

If Core uses icon buttons and Annotate does not yet have equivalent actions, do not add non-functional placeholders.

## Non-goals

Do not change:

- left sidebar
- editor layout
- editor toolbar
- BBox logic
- canvas behavior
- mask logic
- API contracts
- auth backend
- project/image routes

Do not introduce:

- new component library
- CDN fonts/icons/Tailwind
- non-functional top-level navigation tabs
- placeholder pages

## Acceptance criteria

- [x] SaPen Annotate topbar visually matches SaPen Core topbar more closely.
- [x] Breadcrumb/topbar navigation no longer looks like local tab navigation.
- [x] `Projects` is shown in Core-style breadcrumb/navigation treatment.
- [x] Unnecessary top-level main tabs are removed.
- [x] No second navigation row is shown solely for top-level module tabs.
- [x] Vertical space is reduced compared with the current implementation.
- [x] SaPen logo size matches SaPen Core or is slightly smaller, not larger.
- [x] Existing logout/auth behavior is preserved.
- [x] Existing routes are preserved.
- [x] No editor/sidebar/canvas/mask logic is changed.
- [x] Typecheck/lint/build status is reported.

## Validation

Inspect local `package.json` and run the repo-appropriate checks.

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

Also check that no prototype/CDN artifacts were introduced:

```text
cdn.tailwindcss.com
fonts.googleapis.com
Material Symbols
```

Completed validation:

- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run build` - passed.
- `npm run check:design-hardcoding` - passed.
- `npm run check:docs-links` - passed.
- `rg -n "cdn.tailwindcss.com|fonts.googleapis.com|Material Symbols" src docs` - no matches.
- `rg -n "aria-label=\"Primary navigation\"|after:absolute.*accent-primary|WorkspaceTopTabs" src/components/shell src/features/projects` - no matches.
- `npm test` - attempted; failed on pre-existing/local environment issues: integration tests cannot connect to Prisma at `127.0.0.1:55432` with `EPERM`, and unrelated CLI/handoff help-output assertions receive empty stdout. No failure points to the DESIGN-007 topbar/project workspace changes.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement DESIGN-007: Fix Annotate Topbar Breadcrumbs, Remove Redundant Main Tabs, and Match SaPen Core Logo Sizing.

Important:
The SaPen Core reference repository is located at ../sapen relative to the sapen-annotate repository root.
Use ../sapen/... paths for read-only inspection.
Do not import directly from ../sapen at runtime unless the repo is intentionally configured to do so.

First inspect:
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/apps/sapen-core/src/features/shell/AppShellLayout.tsx
../sapen/packages/ui/src/styles/theme.css
../sapen/packages/assets/src/index.ts
../sapen/packages/assets/src/sapen-logo-grey.svg
../sapen/packages/assets/src/sapen-logo-white.svg

Then inspect the local sapen-annotate topbar/shell implementation.

Required changes:
1. Make the topbar breadcrumb/navigation treatment match SaPen Core.
   - Projects must not look like a local tab with underline.
   - Do not use editor/local-tab styling for topbar breadcrumbs.
   - Mirror Core AppTopBar breadcrumb/nav style.

2. Remove unnecessary SaPen Annotate main tabs.
   - No Quick Analysis / Datasets / Workflows / placeholder top-level tabs.
   - No extra second row for top-level tabs.
   - Keep only the minimal Core-style Projects breadcrumb/navigation needed.

3. Fix logo size.
   - Current logo is far too large.
   - Use same logo sizing as SaPen Core if possible.
   - Cap height and preserve aspect ratio.
   - Logo must not increase topbar height.
   - Remove oversized arbitrary sizing classes.

4. Preserve right-side auth/logout behavior.
   - Keep it compact and Core-like.
   - Do not add non-functional placeholder icons.

Do not change:
- sidebar
- editor
- BBox logic
- canvas/mask behavior
- API contracts
- auth backend
- routes

Run:
- npm run typecheck
- npm run lint
- npm run build
- npm test if appropriate

Report:
A. What changed
B. Files changed
C. Which Core topbar patterns/classes/assets were mirrored or reused
D. Confirmation that redundant tabs/second row were removed
E. Confirmation that logo sizing now matches Core
F. Validation results
```

## Suggested commit message

```text
Polish annotate topbar to match SaPen Core
```
