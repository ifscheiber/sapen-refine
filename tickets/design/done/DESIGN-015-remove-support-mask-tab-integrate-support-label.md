# DESIGN-015 — Remove Support Mask Tab and Integrate Support as Cu-Family Label

## Status

Done

## Type

Editor workflow simplification / support-mask validation ticket

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

Remove the separate `Support Mask` local tab from the Annotation Editor.

Support-mask drawing should be integrated into the normal semantic annotation workflow as the `Support` label, but only when annotating Cu staining where a support mask is required.

## Product decision

A separate `Support Mask` tab is unnecessary.

When the user annotates Cu staining:

- the `Support` label is available in the normal label toolbar
- support mask is drawn using the normal annotation tools
- support mask is required before export/submission
- support mask defines/clips the valid area for Cu labeling once it exists

When the user annotates Sapwood/Heartwood:

- support mask should not be a separate editable tab
- support geometry can be derived where needed from semantic foreground, especially for navigator/display use
- the user should not have to switch to a support tab

## Required reference inspection

Inspect local editor family/label/tool code:

```text
src/features/editor/CropSemanticEditorPage.tsx
src/features/editor/CropSemanticEditorClient.tsx
src/features/editor/CropEditorSliceNavigatorRailClient.tsx
src/app/app/projects/[projectId]/images/[imageId]
src/lib/projectsClient.ts
```

Search for:

```text
Support Mask
support mask
Support
Cu
Copper
Sapwood
Heartwood
family
label
polygon
lasso
brush
clip
```

Inspect SaPen Refine label references read-only:

```text
../sapen/apps/sapen-refine/src/mask/labels.ts
../sapen/apps/sapen-refine/src/app/app/shell/annotationConfig.ts
```

Inspect SaPen Core/Refine editor references for tool visibility and mask clipping patterns, but do not port large logic:

```text
../sapen/apps/sapen-core/src/features/quick-analysis
../sapen/apps/sapen-refine/src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx
```

## Required changes

### 1. Remove `Support Mask` local tab

Remove the `Support Mask` tab from the editor local tabs.

The remaining editor flow should rely on:

```text
BBoxes
Semantic Masks
Export Readiness
```

plus whatever other non-redundant tabs remain after DESIGN-014.

### 2. Make `Support` a label in Cu annotation family

When active annotation family is Cu/Copper:

- show `Support` as a label in the label toolbar
- allow the user to draw support mask with limited tools
- support mask is a single mask for that slice/context

When active family is Sapwood/Heartwood:

- do not show support as an editable user label unless existing product logic explicitly requires it
- no support tab

### 3. Tool restrictions for Support label

For support mask drawing, only these tools are needed:

```text
Polygon
Lasso
```

Brush should not be the primary or expected support-mask tool.

When `Support` label is selected:

- show/enable only `Polygon` and `Lasso`
- disable or hide `Brush` for support drawing
- keep UI compact

### 4. Support mask replacement behavior

Only one support mask can exist.

Therefore:

- drawing a new support mask replaces the previous one
- before replacing an existing support mask, warn the user

Suggested warning:

```text
A support mask already exists. Drawing a new support mask will replace it.
```

Require explicit confirmation before replacement if the existing support mask is persisted/confirmed.

A separate “delete support mask” tool is not required if replacement is clear and safe.

If deletion is still needed for correction:

- provide a compact `Clear support mask` action only if existing logic supports safe clearing
- warn before clearing
- do not make it a primary workflow action

### 5. Support mask validity check

A support mask is valid only if it contains all Cu-annotated pixels/fields.

Validation rule:

```text
all Cu pixels must be inside support mask
```

If invalid:

- show compact warning
- block export/submission/ready state
- guide user to enlarge/redraw support mask or adjust Cu annotation

Suggested warning:

```text
Support mask must include all Cu annotations.
```

### 6. Cu labeling clipped to support mask once support exists

If a support mask exists, users must not be able to label Cu outside the support mask.

Required behavior:

- If no support mask exists, Cu can be drawn anywhere.
- Once a support mask exists, Cu drawing is clipped to the support mask.
- Pixels outside support mask must remain unchanged/background when drawing Cu.
- If user attempts to draw outside support area, optionally show a compact hint:

```text
Cu labels are limited to the support mask.
```

This should apply to all Cu drawing tools, including Polygon/Lasso/Brush if Brush remains available for Cu.

### 7. Order-independent workflow

The workflow must support both orders:

#### User draws Cu first, then Support

- Cu can be drawn anywhere initially.
- Later support mask must include all Cu pixels.
- If support does not include all Cu pixels, validation blocks completion.

#### User draws Support first, then Cu

- Support mask exists.
- Subsequent Cu labeling is clipped to support mask.
- User cannot create Cu pixels outside support mask.

### 8. Semantic exclusivity

Maintain existing semantic exclusivity:

- Each pixel can only have one semantic label at a time.
- Support mask is not another semantic class layered on top of Cu.
- Support should be treated as a mask/constraint for Cu-family workflow, not as a second semantic class occupying the same pixel in the semantic label map unless the existing data model already separates it.

Codex must inspect the current data model before implementing. If support is currently stored in a separate mask layer, preserve that. If support is currently modeled as a label, avoid creating invalid multi-label semantics.

## Functional boundaries

Do not change:

- label IDs unless already supported
- mask storage contracts
- Core handoff contracts
- export file format
- autosave/commit contracts
- auth/RBAC
- BBox logic
- image upload/project APIs

If current storage model cannot support support-as-label cleanly without larger work:

- remove the tab only if safe
- surface support drawing inside Semantic Masks using existing storage paths
- document follow-up limitations
- do not create incompatible mask formats

## Acceptance criteria

### UI

- [x] `Support Mask` local tab is removed.
- [x] `Support` appears as label only in Cu/Copper annotation family where needed.
- [x] Support drawing uses only Polygon and Lasso.
- [x] Brush is hidden/disabled for Support label.
- [x] Existing editor layout remains compact.

### Support replacement

- [x] Only one support mask exists per relevant slice/context.
- [x] Drawing a new support mask warns before replacing an existing support mask.
- [x] Existing support mask is replaced only after explicit confirmation if persisted/confirmed.

### Validation

- [x] Support mask is required for Cu-family completion/export.
- [x] Support mask validity checks that all Cu pixels are inside support mask.
- [x] Invalid support mask blocks completion/export/submission.
- [x] Warning is clear and compact.

### Cu clipping

- [x] If no support mask exists, Cu can be drawn anywhere.
- [x] If support mask exists, Cu drawing is clipped to support mask.
- [x] Cu pixels cannot be created outside support mask after support exists.
- [x] This applies to all Cu drawing tools.

### Regression

- [x] Sapwood/Heartwood annotation still works.
- [x] Cu annotation still works.
- [x] Existing mask save/commit works.
- [x] Export readiness still works.
- [x] No storage/API/handoff contract regressions.
- [x] Tests updated.

## Validation

Manual smoke checklist:

1. Open Cu/Copper annotation image.
2. Verify no `Support Mask` tab exists.
3. Select `Support` label.
4. Verify only Polygon/Lasso are available for Support.
5. Draw support mask.
6. Try drawing another support mask and verify replacement warning.
7. Draw Cu inside support mask.
8. Try drawing Cu outside support mask and verify it is clipped/not applied.
9. Draw Cu first on a fresh slice, then draw support mask that does not contain all Cu.
10. Verify validation warns and blocks readiness/export.
11. Redraw support to include Cu.
12. Verify readiness/export can proceed if other requirements pass.
13. Open Sapwood/Heartwood annotation.
14. Verify support tab is absent and support label is not incorrectly shown.
15. Save/commit masks.

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

Implement DESIGN-015: Remove Support Mask Tab and Integrate Support as Cu-Family Label.

Product decisions:
- Remove the Support Mask local tab.
- Support mask drawing belongs inside the normal Semantic Masks workflow as the Support label, only for Cu/Copper annotation family.
- Support drawing only needs Polygon and Lasso.
- Only one support mask can exist.
- Drawing a new support mask replaces the previous one, but warn the user first.
- A valid support mask must contain all Cu pixels.
- Once support mask exists, Cu labeling must be clipped to the support mask.
- If no support mask exists, Cu can be drawn anywhere until support is created.
- Support mask is required for Cu-family completion/export.

Do not change storage/handoff/API contracts unless the existing model already supports the needed UI behavior.

Inspect current label/mask model first. Preserve semantic exclusivity: each pixel belongs to one semantic class; support should not create invalid multi-label semantics.

Remove/hide:
- Support Mask tab
- Brush for Support label
- separate support-tab workflow

Keep:
- Sapwood/Heartwood annotation behavior
- Cu annotation behavior
- mask save/commit contracts
- export readiness behavior, updated for support validity
- Core handoff contracts

Run validation and report:
A. files changed
B. how Support is surfaced as label
C. how support replacement warning works
D. how support validity is checked
E. how Cu clipping to support is implemented
F. storage/model constraints discovered
G. validation results
H. follow-ups
```

## Suggested commit message

```text
Fold support mask workflow into Cu annotation labels
```
