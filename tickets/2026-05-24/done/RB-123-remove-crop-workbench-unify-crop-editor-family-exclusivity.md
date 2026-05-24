# RB-123 - Remove Crop Workbench And Unify Crop Annotation Editor With Family Exclusivity

## Status

Done

## Priority

P1/P2 for annotation UX simplification and semantic correctness

## Type

UX Simplification / Crop Editor / Annotation Semantics / Mask Family Exclusivity / Tests

## Source

- Post DESIGN-001 / DESIGN-002 manual app walkthrough.
- User finding: the intermediate Crop Workbench is not needed; opening a crop should go directly into the editor.
- User finding: there should be a single editor where the user chooses between:
  - `Sapwood / Heartwood`
  - `Cu / Support mask`
- User requirement: selecting one family disables the other family; once an annotation exists in one family, the opposite family remains unavailable until that annotation is removed.
- Related recent tickets:
  - DESIGN-002 authenticated workspace alignment.
  - RB-121 Annotator role workspace surface and API access boundary.
  - RB-122 Remove redundant project Images screen and action.
  - RB-107 safe version allocation.
  - RB-106 protected API error contracts.
  - RB-116 audit coverage matrix and guard.
- RB-113 remains open as real iPad Safari evidence gate.

## Target Repository

Work in the `sapen-annotate` repository.

## Context

The current crop workflow still contains an intermediate Crop Workbench screen. In practice, that extra screen does not add enough value for the annotator workflow.

The intended UX is simpler:

1. User opens/selects a crop/slice from the project image workflow.
2. The app directly opens the crop annotation editor.
3. Inside the single editor, the user chooses which annotation family they want to edit:
   - `Sapwood / Heartwood`
   - `Cu / Support mask`
4. The editor enforces that only one family can be active for a crop at a time.

This reflects the underlying domain reality: a crop/slice should not simultaneously be treated as both a Sapwood/Heartwood annotation target and a Cu/Support-mask annotation target. Once a user has drawn one family, the opposite family must remain unavailable until the current family's annotation is fully removed.

Example:

- If the user draws Heartwood, `Cu / Support mask` becomes unavailable.
- It stays unavailable until the Heartwood annotation is removed and no Sapwood annotation exists.
- If the user draws Sapwood, `Cu / Support mask` is also unavailable.
- If the user draws Cu or a Support mask, `Sapwood / Heartwood` becomes unavailable.
- Unlocking occurs only when all pixels/objects belonging to the currently annotated family are removed.

## Goal

Remove the unnecessary intermediate Crop Workbench and replace the current split crop editing experience with one unified crop annotation editor that enforces mutually exclusive annotation families.

The resulting annotator flow should be:

```text
Project Overview → Image/Crop selection → Unified Crop Annotation Editor
```

not:

```text
Project Overview → Image/Crop selection → Crop Workbench → separate support/semantic editors
```

## Non-Goals

- Do not rewrite the canvas rendering engine from scratch.
- Do not change raw image storage.
- Do not change append-only versioning semantics.
- Do not remove backend support/semantic mask artifacts if they are still the correct persistence model.
- Do not merge DB tables or storage objects unless the current schema absolutely requires it.
- Do not change model/prediction import semantics.
- Do not implement Core handoff.
- Do not implement RB-118 public-upload hardening follow-ups.
- Do not complete or fabricate RB-113 iPad Safari evidence.

The expected implementation is primarily a UX/workflow unification with a clear semantic lock, while preserving existing stable persistence paths wherever possible.

## Required Investigation

Inspect the current crop workflow after DESIGN-002/RB-122.

At minimum, locate and inspect:

### Crop Workbench / Routing

Likely areas, use actual paths if different:

```text
src/app/app/projects/[projectId]/...
src/app/app/projects/[projectId]/images/...
src/app/app/projects/[projectId]/images/[imageId]/...
src/app/app/slice-crops/...
src/features/editor
src/features/crop
src/components
```

Find:

- route(s) that open the Crop Workbench,
- route(s) that open crop support editor,
- route(s) that open crop semantic editor,
- navigation actions/buttons from project/image/crop list,
- back/next links that point through the workbench.

### Existing Editors

Inspect current editor components and domain calls for:

- crop support mask editing,
- crop semantic mask editing,
- Sapwood / Heartwood labels,
- Cu labels,
- support mask persistence,
- semantic mask persistence,
- save/reload behavior,
- dirty state,
- undo/redo if present,
- canvas interaction hooks.

### Persistence And APIs

Inspect existing APIs/domain functions for:

- crop support mask save/load,
- crop semantic mask save/load,
- version allocation,
- audit/logging,
- review/export eligibility impacts,
- existing tests.

Do not assume that “one editor” means “one backend artifact.” Prefer preserving the existing support/semantic persistence contracts and unify only the UI if that is the lower-risk path.

## Definitions

### Annotation Families

This ticket defines two mutually exclusive annotation families for one crop:

#### Family A: Sapwood / Heartwood

Includes any user-created annotation pixels/objects for:

- Sapwood
- Heartwood

This likely maps to existing semantic mask labels.

#### Family B: Cu / Support mask

Includes any user-created annotation pixels/objects for:

- Cu / copper-stained region
- Support mask / valid slice support region

This may currently be split across semantic-mask and support-mask artifacts. The UI should treat them as one family for selection/locking purposes.

### Empty Family

A family is considered empty only when it contains no user annotation data.

Examples:

- Sapwood / Heartwood is empty when there are no Sapwood pixels and no Heartwood pixels.
- Cu / Support mask is empty when there are no Cu pixels and no Support-mask pixels.

Implementation must define this precisely according to the current mask label values and support-mask representation.

### Family Lock

A family lock is a UI/domain rule:

- if Family A has any annotation, Family B cannot be selected or edited;
- if Family B has any annotation, Family A cannot be selected or edited;
- the opposite family becomes selectable again only after the current family's annotation is fully removed.

Do not silently delete the opposite family's data to resolve a conflict.

## Desired UX

### Direct Editor Opening

From project/image/crop workflows:

- selecting `Open editor` or equivalent should open the unified crop annotation editor directly.
- the old Crop Workbench should no longer be a required intermediate step.
- if an old workbench URL is visited directly, it should redirect to the unified editor or show a clear redirect/fallback, not a duplicate workflow.

### Unified Editor Layout

The editor should contain:

- image/crop canvas,
- tool controls,
- save/reload controls,
- active annotation family selector:
  - `Sapwood / Heartwood`
  - `Cu / Support mask`
- family-lock state message when one family is unavailable,
- existing status/error/save messages.

The selector should behave like a workflow mode choice, not like independent layer toggles.

### Family Selector Behavior

If neither family has annotations:

- both family options are selectable.
- user can choose either family.

If Sapwood / Heartwood has annotations:

- `Sapwood / Heartwood` remains active/selectable.
- `Cu / Support mask` is disabled.
- disabled reason should be visible, e.g.:

```text
Cu / Support mask is unavailable because this crop already contains Sapwood/Heartwood annotation. Remove Sapwood/Heartwood annotation to switch families.
```

If Cu / Support mask has annotations:

- `Cu / Support mask` remains active/selectable.
- `Sapwood / Heartwood` is disabled.
- disabled reason should be visible.

If both families already contain annotations due to legacy data or previous bugs:

- do not auto-delete anything.
- show an explicit conflict state.
- allow viewing both family states if technically possible.
- require the user to remove one family or create a focused follow-up if the current editor cannot resolve conflicts safely.
- save should not create further inconsistent data.

### Tool Availability

When `Sapwood / Heartwood` is active:

- Sapwood and Heartwood tools are available.
- Cu and Support-mask tools are disabled/hidden.
- Save writes only the relevant artifacts for that family according to existing persistence rules.

When `Cu / Support mask` is active:

- Cu and Support-mask tools are available.
- Sapwood and Heartwood tools are disabled/hidden.
- Save writes only the relevant artifacts for that family according to existing persistence rules.

### Annotation Removal And Unlocking

The user must be able to remove all annotation data in the active family.

After all annotations in the active family are removed and saved or reflected in editor state:

- the opposite family becomes selectable again.
- the UI must not require page reload unless unavoidable; if reload is required, document and minimize it.

## API / Domain Enforcement

UI-only enforcement is not enough.

Add server-side validation where current save APIs could otherwise create conflicting family data.

Requirements:

- Saving Sapwood/Heartwood annotations must fail with a stable conflict error if Cu/Support annotations already exist for that crop.
- Saving Cu/Support annotations must fail with a stable conflict error if Sapwood/Heartwood annotations already exist for that crop.
- The conflict check must allow saving an empty/removal state that clears the current family.
- The conflict check must be compatible with RB-107 safe version allocation and RB-106 stable API error contract.
- Error code should be stable, for example:
  - `CROP_ANNOTATION_FAMILY_CONFLICT`
- Use existing error helper conventions.

If current backend cannot cheaply inspect the opposite family, document the limitation and add a focused follow-up. But for correctness, the final desired state is server-enforced exclusivity.

## Routing Requirements

Remove or bypass the Crop Workbench route/screen.

Preferred route behavior:

- canonical editor route opens unified crop editor directly.
- old workbench route redirects to canonical editor route.
- old support/semantic editor routes redirect or are replaced by the unified editor with mode param only if needed.

Possible route pattern:

```text
/app/projects/[projectId]/images/[imageId]/crops/[cropId]/editor
```

or keep the existing canonical editor route if one already exists.

Do not create multiple permanent editor routes unless there is a strong reason.

## State / Persistence Requirements

Preserve:

- append-only versioning,
- current storage key families,
- current audit/review/export behavior where applicable,
- existing version allocation helper,
- existing API error wrapper behavior.

Define how family state is derived from saved data:

- from latest committed support mask,
- from latest committed crop semantic mask,
- from editor draft state,
- from review-approved state if that matters.

Document the chosen rule.

## Tests

Add or update tests for:

### Unit Tests

- family-state derivation:
  - empty crop,
  - Sapwood only,
  - Heartwood only,
  - Sapwood + Heartwood,
  - Cu only,
  - Support only,
  - Cu + Support,
  - conflicting legacy state.
- family selector enable/disable logic.
- conflict error mapping.

### API / Domain Tests

- saving Sapwood/Heartwood when Cu/Support exists returns stable conflict.
- saving Cu/Support when Sapwood/Heartwood exists returns stable conflict.
- clearing a family is allowed.
- saving after clearing unlocks the opposite family.
- conflict responses use stable JSON API contract.

### UI / E2E Tests

- crop opens directly in unified editor, not workbench.
- no required workbench intermediate step.
- family selector shows both choices when empty.
- drawing Heartwood disables Cu/Support.
- drawing Cu/Support disables Sapwood/Heartwood.
- clearing annotations re-enables the opposite family.
- old workbench route redirects or falls back safely.
- existing save/reload still works.

If full E2E is too heavy, add targeted component/route tests and document the remaining manual smoke check.

## Documentation

Update docs to reflect the new workflow:

- project/image/crop workflow docs,
- current-state docs,
- known gaps if any limitation remains,
- audit coverage matrix if new route/API mutation classification is introduced,
- route docs if present,
- sprint/ticket index.

Document:

- Crop Workbench removed/bypassed.
- Unified editor is the canonical crop annotation surface.
- Annotation families are mutually exclusive.
- Server-side conflict rule exists.
- Legacy conflict behavior if any.

Do not claim RB-113 iPad validation is complete.

## Acceptance Criteria

- Crop Workbench is no longer part of the normal annotation flow.
- Opening a crop goes directly to one unified crop annotation editor.
- The editor lets the user choose between:
  - `Sapwood / Heartwood`
  - `Cu / Support mask`
- Selecting one family disables the opposite family.
- Existing annotation in one family blocks selection/editing of the opposite family until removed.
- Clearing the active family unlocks the opposite family.
- Server/API prevents saving conflicting opposite-family annotations.
- Stable error code is used for family conflicts.
- Existing save/reload/versioning behavior remains intact.
- Old workbench route is removed, redirected, or clearly deprecated without leaving duplicate UX.
- Tests cover family-lock logic and route simplification.
- Docs describe the new unified editor workflow.
- RB-113 remains open unless real iPad Safari evidence exists.
- Worktree is clean and handoff dry-run passes.

## Implementation Notes

- Canonical selected-crop route `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]` now renders the unified crop annotation editor directly.
- Old crop-prefixed and non-crop-prefixed `/support` and `/semantic` crop routes redirect into the canonical editor with `target`/`mode` query parameters.
- Removed the standalone crop workbench and crop support editor components; support-mask editing now reuses the unified crop editor canvas and save/reload flow.
- Added `src/server/domain/cropAnnotationFamilies.ts` for byte-derived family occupancy and save-time conflict enforcement across Sapwood/Heartwood semantic pixels, Copper semantic pixels, and support-mask foreground pixels.
- Added server-side `CROP_ANNOTATION_FAMILY_CONFLICT` checks for semantic and support saves while still allowing all-background clearing saves.
- Updated crop readiness filtering so all-background clearing versions do not keep a family artificially active.
- Updated focused unit, integration, and E2E coverage plus crop workflow, route, component, testing, and manual-smoke docs.
- RB-113 remains open; no iPad Safari evidence was created or claimed.

## Validation Results

- `git diff --check` passed.
- `npm run prisma:generate` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run test` passed: 56 files, 278 tests.
- `npm run test:e2e` passed: 14 browser tests.
- `npm run check:docs-links` passed.
- `npm run check:design-hardcoding` passed.
- `npm run build` passed.
- `npm run handoff:archive -- --dry-run` passed after commit.

## Validation

Run:

```bash
git status --short
git diff --check
npm run prisma:generate
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run check:docs-links
npm run handoff:archive -- --dry-run
```

If migrations are added, also run:

```bash
npm run db:rebuild
npm run test
```

If E2E is not feasible locally, document why and run targeted UI/API tests instead.

## Manual Smoke Checklist

After implementation, test at least:

1. Open project overview.
2. Open image/crop.
3. Confirm unified editor opens directly.
4. Confirm no required Crop Workbench step appears.
5. Start with empty crop:
   - both families selectable.
6. Draw Heartwood:
   - Cu/Support becomes disabled.
7. Remove Heartwood and Sapwood:
   - Cu/Support becomes selectable.
8. Draw Support or Cu:
   - Sapwood/Heartwood becomes disabled.
9. Save/reload:
   - lock state persists correctly.
10. Direct old workbench URL:
   - redirects or falls back safely.

## Completion Protocol

1. Implement direct editor routing and remove/bypass workbench.
2. Implement unified editor family selector and lock logic.
3. Add server-side conflict validation.
4. Add/update tests.
5. Update docs and route/audit matrices if needed.
6. Add follow-up tickets for any legacy conflict cleanup or iPad-specific UX issue discovered.
7. Leave RB-113 open unless physical iPad evidence exists.
8. Commit the completed slice.
9. Ensure `npm run handoff:archive -- --dry-run` passes.

## Notes For Codex

- Treat this as an annotation UX simplification plus semantic safety ticket.
- Do not merge backend artifacts unless necessary.
- Prefer one UI editor over multiple editor pages.
- Do not silently delete conflicting existing data.
- Keep versioning/audit behavior stable.
- Do not fabricate RB-113 evidence.
