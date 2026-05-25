# DESIGN-005 — Align SaPen Annotate Top Bar with SaPen Core AppTopBar

## Status

Completed

## Implementation notes

- Inspected the SaPen Core shell references in `../sapen`, including `AppTopBar`, `AppShellLayout`, shared UI theme CSS, and `@sapen/assets`.
- Mirrored Core `AppTopBar` locally because SaPen Annotate does not currently depend on `@sapen/ui` or `@sapen/assets`; direct runtime imports from `../sapen` remain out of scope.
- Copied the real Core grey SaPen logo into `public/sapen-logo-grey.svg` and removed the authenticated topbar's temporary purple `S`, `SaPen Annotate`, and `Ground-truth workspace` brand block.
- Kept only the implemented `Projects` top navigation item and preserved the existing `/app` to `/app/projects` redirect.
- Converted the right-side authenticated shell controls to compact Core-style icon actions while preserving the existing `/api/auth/logout` behavior.
- Updated shell/design documentation and added a remediation-backlog entry for future shared shell/assets package extraction.
- Automated checks run:
  - Baseline `npm run typecheck`: passed.
  - Baseline `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run build`: passed.
  - `npm run check:design-hardcoding`: passed.
  - Prototype artifact grep in `src docs`: passed.
  - Authenticated-shell brand grep: no removed topbar subtitle or purple mark remains; only unrelated not-found `SaPen Annotate` copy remains.
  - `npm test`: attempted; existing local failures remained. Integration suites could not connect to `127.0.0.1:55432` (`EPERM`), and unrelated CLI-output unit expectations for secret handling, handoff archive, and trial bootstrap saw empty stdout.

## Type

Design / UI shell reuse ticket

## Target repository

Work in the `sapen-annotate` repository.

## Reference repository path

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

When inspecting SaPen Core files, use paths prefixed with `../sapen/...`.

Do **not** assume that `apps/sapen-core/...` exists inside `sapen-annotate`.

## Goal

Replace or refactor the current SaPen Annotate authenticated top bar so that it matches the SaPen Core project top bar / page shell style.

The current SaPen Annotate top bar still looks like a separate implementation:

- temporary purple `S` mark
- `SaPen Annotate` title with subtitle `Ground-truth workspace`
- simple `Projects` tab
- text-based `Admin`, email, and `Log out` on the right

The target is to make SaPen Annotate feel like a SaPen product module that belongs to the same product family as SaPen Core.

Where possible, reuse existing SaPen Core components or shared UI/assets rather than inventing a new top bar.

## Important design decision

The SaPen Annotate authenticated top bar should align with SaPen Core, not with the temporary login mockup.

The temporary `S` logo mark is acceptable only until the real SaPen logo/assets are available. If the SaPen logo asset is available through shared assets, use it.

## Required reference inspection

From `sapen-annotate`, inspect these SaPen Core files using `../sapen/...` paths:

```text
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/apps/sapen-core/src/features/shell/AppShellLayout.tsx
../sapen/apps/sapen-core/src/features/shell/AppSidebar.tsx
../sapen/packages/ui/src/styles/theme.css
../sapen/packages/ui/src/styles/index.css
../sapen/packages/assets/src/index.ts
../sapen/packages/assets/src/sapen-logo-grey.svg
../sapen/packages/assets/src/sapen-logo-white.svg
```

Also inspect local SaPen Annotate shell files, for example:

```text
src/app/app/AppShell.tsx
src/components/TabSidebar.tsx
src/components/ProjectLibrary.tsx
src/app/app/projects/page.tsx
src/app/app/projects/[projectId]/page.tsx
```

If paths differ, locate equivalent files.

## Reuse strategy

Prefer the lowest-risk reuse path:

1. If `sapen-annotate` already depends on shared `@sapen/ui` / `@sapen/assets`, reuse the same AppTopBar-related primitives/assets where possible.
2. If the SaPen Core `AppTopBar` can be extracted into a shared package cleanly and without broad churn, do so.
3. If direct reuse/extraction is too large for this ticket, create a small local Annotate top bar component that mirrors the SaPen Core `AppTopBar` API/style as closely as possible and document shared extraction as a follow-up.

Do **not** import directly from `../sapen/...` at runtime unless the repository is intentionally configured for that. The `../sapen` path is primarily a read-only reference source.

## Target top bar behavior

### Left / brand area

Match SaPen Core style:

- real SaPen logo if available
- product label:
  - either `SaPen`
  - or `SaPen Annotate` if module naming is required
- avoid the temporary purple `S` mark if a SaPen logo asset is available
- remove or strongly de-emphasize the subtitle `Ground-truth workspace` in the top bar

The top bar should not feel like a separate app shell.

### Top navigation

Use SaPen Core-style top navigation tabs.

Minimum:

```text
Projects
```

Optional only if implemented/meaningful:

```text
Quick Analysis
Datasets
Workflows
```

Do not show placeholder nav items that route nowhere.

Active tab should use the same underline/accent treatment as SaPen Core.

### Right side

Align with SaPen Core right-side icon/action style.

Preferred:

- compact icon buttons if those actions exist
- account/user icon or menu
- log out in an account menu or compact action

Avoid the current text-heavy right side:

```text
Admin
admin@sapen.local
Log out
```

If an account menu does not exist yet, keep a minimal accessible fallback, but make it visually compatible with SaPen Core.

### Layout/styling

- compact height matching SaPen Core
- same dark background token
- same bottom border token
- same horizontal spacing
- same typography scale
- same active tab indicator
- no heavy shadows
- no bright non-Core colors

Use existing CSS variables/tokens where available:

```text
--shell-topbar-bg
--app-background
--border-subtle
--text-primary
--text-secondary
--text-muted
--accent-primary
--brand
```

## Scope

This ticket is limited to the authenticated top bar / top app shell area.

It may touch local shell composition if needed, but it must not redesign:

- left sidebar
- Projects page main content
- editor canvas
- toolbar logic
- BBox logic
- mask logic
- auth backend
- routing contracts

## Explicit non-goals

Do not:

- rewrite the full AppShell
- change project/sidebar behavior
- change editor logic
- change canvas logic
- change mask serialization/storage
- introduce a new component library
- use CDN fonts/icons
- copy-paste large unrelated SaPen Core shell code without adapting it
- add non-functional placeholder navigation links

## Acceptance criteria

- [ ] SaPen Annotate authenticated top bar visually matches SaPen Core AppTopBar style.
- [ ] SaPen Core `AppTopBar` and related shell/assets files were inspected through `../sapen/...`.
- [ ] Existing SaPen logo/shared assets are reused if available.
- [ ] Temporary purple `S` mark is removed if a real SaPen logo asset is available.
- [ ] Active top navigation uses SaPen Core-style underline/accent treatment.
- [ ] Right-side account/logout area is compact and SaPen Core-like.
- [ ] Existing logout/auth behavior is preserved.
- [ ] Existing routing is preserved.
- [ ] No left-sidebar/editor/canvas/mask logic is changed.
- [ ] Typecheck/lint/build status is reported.

## Validation

Inspect local `package.json` and run repo-appropriate checks.

At minimum attempt:

```bash
npm run typecheck
npm run lint
npm run build
```

If tests exist and are relevant:

```bash
npm test
```

Also grep/check that no prototype/CDN artifacts are introduced:

```text
cdn.tailwindcss.com
fonts.googleapis.com
Material Symbols
```

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement DESIGN-005: Align SaPen Annotate Top Bar with SaPen Core AppTopBar.

Important:
The SaPen Core reference repository is located at ../sapen relative to the sapen-annotate repository root.
Use ../sapen/... paths when inspecting SaPen Core files.
Do not assume apps/sapen-core exists inside sapen-annotate.

First inspect:
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/apps/sapen-core/src/features/shell/AppShellLayout.tsx
../sapen/packages/ui/src/styles/theme.css
../sapen/packages/assets/src/index.ts
../sapen/packages/assets/src/sapen-logo-grey.svg
../sapen/packages/assets/src/sapen-logo-white.svg

Then inspect local sapen-annotate shell files:
src/app/app/AppShell.tsx
src/components/TabSidebar.tsx
src/components/ProjectLibrary.tsx
src/app/app/projects/page.tsx
src/app/app/projects/[projectId]/page.tsx

If paths differ, locate equivalent files.

Goal:
Refactor the authenticated SaPen Annotate top bar so that it matches the SaPen Core AppTopBar style.

Requirements:
- reuse shared @sapen/ui / @sapen/assets if available
- otherwise mirror SaPen Core AppTopBar locally with minimal scoped changes
- use real SaPen logo asset if available
- remove temporary purple S mark if a real logo can be used
- keep compact dark top bar
- use SaPen Core-style active navigation underline
- make right-side account/logout area compact and Core-like
- preserve existing logout/auth behavior
- preserve routing
- do not touch sidebar, editor, canvas, mask logic, or API contracts

Do not import from ../sapen at runtime unless the repo is intentionally configured for it.
Do not introduce CDN fonts/icons/Tailwind.
Do not add a new component library.

Run validation:
- npm run typecheck
- npm run lint
- npm run build
- npm test if appropriate

Report:
A. What changed
B. Files changed
C. Whether Core AppTopBar/assets were reused, extracted, or mirrored
D. How auth/logout behavior was preserved
E. Validation results
F. Follow-ups, if shared extraction is still needed
```

## Suggested commit message

```text
Align annotate top bar with SaPen Core shell
```
