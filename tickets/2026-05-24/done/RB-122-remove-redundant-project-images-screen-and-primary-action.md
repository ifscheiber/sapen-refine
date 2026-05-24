# RB-122 - Remove Redundant Project Images Screen And Primary Action

## Status

Done

## Priority

P1/P2 for post-DESIGN workspace simplification and UX clarity

## Type

UX Simplification / Route Cleanup / Navigation Polish / Tests / Documentation

## Source

- Post DESIGN-002 manual app walkthrough.
- User finding: the project overview page already lists the project's images, so the dedicated project images screen adds no value.
- Completed DESIGN-002: authenticated shell and active-project image workspace aligned with SaPen Core.
- Completed RB-121 planned annotator surface hardening (related, because a simpler surface benefits the main customer role).
- RB-113 remains open as real iPad Safari evidence gate.

## Target Repository

Work in the `sapen-annotate` repository.

## Context

After the DESIGN-002 workspace alignment, the intended landing page is the project overview page:

```text
/app/projects/[projectId]
```

On that overview page, the project's images are already listed.

At the same time, there is still a separate screen and primary action for:

```text
/app/projects/[projectId]/images
```

This opens another screen that again shows a table of images, but without meaningful additional value. The dedicated Images screen is therefore redundant and makes the workspace feel more complex than necessary.

The desired product behavior is:

- keep the project overview page as the primary project landing page,
- keep the image table/list on the overview page,
- remove the separate project Images page,
- remove the primary action / local navigation action `Images` that opens that separate page,
- preserve direct annotation/editor actions from the overview page.

## Goal

Simplify the project workspace by removing the redundant project Images screen and its associated primary action, while preserving the overview page as the single image-centric project landing page.

## Non-Goals

- Do not remove image listing from the project overview page.
- Do not remove upload-image functionality.
- Do not remove project settings if they still have value.
- Do not change annotation/editor routes.
- Do not redesign the whole project page again.
- Do not change auth/RBAC behavior except for removing the redundant route from visible navigation.
- Do not fabricate RB-113 iPad Safari evidence.

## Required Investigation

Inspect the current post-DESIGN-002 project workspace and identify where the redundant Images page/action is wired.

At minimum inspect:

```text
src/app/app/projects/[projectId]/page.tsx
src/app/app/projects/[projectId]/images/page.tsx
src/app/app/projects/[projectId]/images/ui.tsx
src/app/app/projects/page.tsx
src/app/app/AppShell.tsx
src/components
src/lib/projectsClient.ts
```

Use actual repo paths if they differ.

Also inspect:

- route links and local tabs/actions on the project page,
- sidebar actions or contextual action rows,
- any breadcrumbs or tab components referencing `Images`,
- tests that assume the `/images` page exists,
- docs/screenshots mentioning the dedicated Images screen.

## Desired Product Behavior

### Keep

The following should remain:

- project overview route:
  - `/app/projects/[projectId]`
- image list/table on the overview page
- image preview/thumbnail behavior
- upload image flow
- open editor action from image rows
- project settings access, if still present and meaningful
- any project summary/context row that helps orient the user

### Remove

The following should be removed:

- dedicated route UI for:
  - `/app/projects/[projectId]/images`
- local primary action / tab / button labeled `Images` if it only navigates to that redundant page
- any duplicate image table component usage that only exists for that redundant screen
- any CTA or navigation pattern that implies the overview page and the images page are separate necessary workspaces

## Route Behavior

Decide the safest handling for the removed route.

Preferred behavior:

- existing navigation should no longer link to `/app/projects/[projectId]/images`
- direct visits to `/app/projects/[projectId]/images` should not hard-404 in a confusing way
- instead, redirect to:
  - `/app/projects/[projectId]`

If the framework/location already supports redirect helpers, use them.

Document the chosen behavior and add tests.

## Implementation Requirements

### 1. Remove Redundant Navigation Surface

Remove the visible primary action / tab / local nav entry that opens the redundant Images screen.

Targets may include:

- local tabs such as `Images`
- project workspace primary actions
- contextual buttons
- duplicate menu entries

The overview page should become the obvious default place to view the project's images.

### 2. Preserve Project Overview As Single Source

Ensure the overview page still contains the image list/table and remains the canonical place for:

- seeing project images,
- opening the editor,
- uploading new images if applicable,
- getting project context.

Do not accidentally regress the overview page into a project-only metadata screen.

### 3. Handle Direct Route Access

Implement a clean redirect or equivalent behavior from:

```text
/app/projects/[projectId]/images
```

to:

```text
/app/projects/[projectId]
```

Do not leave a stale duplicate UI screen unless the redirect mechanism requires a transitional wrapper.

### 4. Remove Redundant UI Code If Safe

If there is a dedicated `images/ui.tsx` or page-only component that becomes unused, remove it or fold any truly needed reusable subparts into the overview page.

Be conservative:

- only remove code that is genuinely redundant,
- keep shared image-table components if they are still reused elsewhere.

### 5. Tests

Add or update tests for:

#### Navigation / UI

- project page no longer shows a redundant `Images` action/tab if that was previously visible,
- project overview still shows the image list,
- open-editor actions still work from overview.

#### Routing

- direct visit to `/app/projects/[projectId]/images` redirects to `/app/projects/[projectId]`, or behaves according to the chosen explicit policy.

#### Regression

- upload image flow still works from the surviving project workspace,
- project settings (if present) still remain reachable,
- no broken links remain in the workspace shell.

### 6. Documentation

Update docs that describe the project workspace.

Likely docs to inspect/update:

```text
docs/00-overview/current-state.md
docs/00-overview/customer-trial-readiness.md
docs/known-gaps.md
docs/testing
tickets/2026-05-23/README.md
```

Also update any design/workspace docs if they still mention a separate project Images screen as part of the intended navigation.

Do not over-document. Keep it concise and current.

## Acceptance Criteria

- The project overview page remains the intended landing page for a project.
- The overview page shows the project's images.
- The redundant project Images page is removed as a separate user-visible workspace.
- The visible primary action / tab `Images` is removed if it only pointed to the redundant screen.
- Direct route access to `/app/projects/[projectId]/images` is handled cleanly, preferably by redirecting to `/app/projects/[projectId]`.
- Open editor and upload image flows still work.
- No broken workspace links remain.
- Tests cover the route and UI simplification.
- RB-113 remains open unless real physical iPad evidence was provided separately.
- Worktree is clean and handoff dry-run passes.

## Validation

Run:

```bash
git status --short
git diff --check
npm run lint
npm run typecheck
npm run test
npm run build
npm run handoff:archive -- --dry-run
```

If route-level or UI E2E coverage exists, also run:

```bash
npm run test:e2e
```

If E2E is not feasible locally, document why and run targeted route/UI tests instead.

## Manual Smoke Checklist

After implementation, verify:

### Project Workspace

- open a project at `/app/projects/[projectId]`
- confirm image list is visible there
- confirm no redundant `Images` action/tab is shown
- confirm upload images still works
- confirm open editor from an image row still works
- confirm project settings, if present, remain accessible

### Removed Route

- manually open `/app/projects/[projectId]/images`
- confirm clean redirect or intended fallback behavior to the overview page

## Completion Protocol

1. Remove the redundant screen/action.
2. Add/update route and UI tests.
3. Update concise docs if needed.
4. Add any small follow-up ticket only if unexpected route-structure issues are discovered.
5. Leave RB-113 open unless physical iPad evidence exists.
6. Commit the completed slice.
7. Ensure `npm run handoff:archive -- --dry-run` passes.

## Notes For Codex

- Treat this as a focused workspace simplification ticket.
- Prefer removal + redirect over keeping duplicate UI.
- Do not over-refactor the project workspace.
- Preserve the overview page as the canonical image workspace.
- Do not fabricate RB-113 evidence.

## Implementation Notes

- Removed the user-visible project `Images` action from `ProjectOperationsNav` and the local `Images` tab from the project workspace.
- Kept `/app/projects/[projectId]` as the canonical image list/upload workspace through `ImagesClient`.
- Changed `/app/projects/[projectId]/images` to redirect to `/app/projects/[projectId]` and removed the now-unused `ProjectImagesPage` wrapper.
- Updated missing-resource fallbacks to link to the project overview instead of the retired project images workspace.
- Updated E2E coverage for upload-from-overview behavior and direct removed-route redirects.
- Updated project/image route docs and testing docs to describe the redirect compatibility route.
- RB-113 remains open; no iPad Safari evidence was created or changed.

## Validation Results

- Baseline before edits: `git status --short` showed untracked RB-122 and unrelated untracked RB-123; `npm run lint` passed; `npm run typecheck` passed.
- `git diff --check` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run test` passed: 56 files, 278 tests.
- `npm run check:docs-links` passed.
- `npm run check:design-hardcoding` passed.
- `npm run build` passed.
- `npm run test:e2e` passed: 14 tests.
- Post-commit `npm run handoff:archive -- --dry-run` was blocked by unrelated untracked `tickets/2026-05-24/RB-123-remove-crop-workbench-unify-crop-editor-family-exclusivity.md`.
- `npm run handoff:archive -- --dry-run --allow-dirty` passed with the unrelated RB-123 ticket left untouched.
