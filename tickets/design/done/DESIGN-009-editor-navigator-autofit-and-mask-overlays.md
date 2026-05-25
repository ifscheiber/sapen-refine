# DESIGN-009 — Editor Navigator Auto-Fit and Annotation Overlay State

## Status

Ready for implementation

## Type

Editor UX / Navigator rendering / annotation overview ticket

## Target repository

Work in the `sapen-annotate` repository.

## Reference repository path

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only reference. Do not import directly from `../sapen` at runtime unless the repo is intentionally configured for this.

## Background

The current right-side editor navigator still looks like a draft/prototype. It shows the full source image with too much background and currently overlays BBoxes with number labels.

The navigator should become a useful editing overview:

- It should zoom/crop to the relevant BBox area after BBox confirmation.
- It should show BBoxes clearly, but without additional number labels.
- Navigation should happen by clicking directly inside a BBox.
- After semantic/support masks are confirmed, the navigator should show their annotation state as overlays.
- This helps users immediately see which slices are already annotated and which still need work.

## Goal

Improve the right-side navigator image in the Annotation Editor so it provides a compact, high-information overview of the active image’s slice annotation state.

The navigator should answer:

```text
Which slices exist?
Which one am I editing?
Which slices already have semantic masks?
Which slices already have support masks?
Where should I click to navigate?
```

## Required reference inspection

Inspect local SaPen Annotate navigator/editor files first:

```text
src/features/editor/CropEditorSliceNavigatorRailClient.tsx
src/features/editor/CropSemanticEditorPage.tsx
src/features/editor/CropSemanticEditorClient.tsx
src/app/app/projects/[projectId]/images/[imageId]
src/app/app/projects/[projectId]/images/ui.tsx
src/lib/projectsClient.ts
```

If paths differ, locate equivalent files.

Inspect SaPen Core / Refine only as read-only references for existing auto-fit / overview / mask rendering logic:

```text
../sapen/apps/sapen-core/src/features/quick-analysis
../sapen/apps/sapen-core/src/features/quick-analysis/components
../sapen/apps/sapen-core/src/features/image-review
../sapen/apps/sapen-core/src/features/experiments/preparation/images
../sapen/apps/sapen-core/src/components/workspace
../sapen/apps/sapen-refine/src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx
../sapen/apps/sapen-refine/src/mask
```

Use `rg`/search in both repositories for:

```text
fit
fitTo
autoFit
bounds
bbox
cropBounds
viewport
overview
navigator
thumbnail
maskOverlay
overlay
semantic
support
contour
outline
```

## Required behavior

### 1. Auto-fit navigator image to confirmed BBox area

After BBox confirmation, the navigator image should no longer show the full source image with excessive background.

Instead, it should auto-fit to the maximum relevant area containing the BBoxes.

Expected behavior:

- Compute the bounding extent of all confirmed/current BBoxes.
- Add a small padding margin around this union area.
- Crop/zoom the navigator viewport so this padded BBox union uses the available navigator space as well as possible.
- Preserve aspect ratio.
- Avoid clipping any BBox.
- Avoid excessive white/background area if BBoxes occupy only a small part of the original image.
- If no BBoxes are confirmed/current, fall back to full-image view.

Conceptually:

```text
navigatorViewport = paddedUnion(allConfirmedBBoxes)
```

This should use or mirror any existing fit-to-content logic from SaPen Core editors if available.

Important:

- This is a navigator viewport/display crop only.
- Do not alter source image data.
- Do not alter BBox coordinates.
- Do not alter crop/mask storage.

### 2. BBoxes visible but no number labels

The navigator should still display BBoxes clearly.

However, remove the number labels currently shown inside BBoxes.

Requirements:

- BBox border remains visible.
- Active/current BBox should have a clear selected outline.
- Non-active BBoxes should have a subtle but visible outline.
- No numeric badges/labels inside BBoxes.
- No duplicated numbering.
- If accessible labels/tooltips are useful, they may exist for screen readers/tooltips, but not as visible labels.

### 3. Navigate by clicking inside a BBox

The navigator should support clicking inside a BBox to navigate/select the corresponding slice.

Expected behavior:

- Click inside a BBox selects that slice/BBox.
- Active slice updates.
- Main editor/canvas updates to the selected slice if existing behavior supports this.
- Cursor/hover state should indicate clickability.
- If BBoxes overlap is impossible due to earlier guardrails, selection is unambiguous.
- If overlapping legacy data exists, use deterministic behavior and show a warning elsewhere if appropriate.

Do not require visible number labels for navigation.

### 4. Show semantic mask overlay after confirmation

After a semantic segmentation/mask is confirmed for a slice, show it in the navigator image as an overlay.

Requirements:

- Use the existing semantic mask data if available.
- Use the same semantic color semantics as the editor where possible.
- Render pixel-accurate semantic mask overlays inside the corresponding BBox/crop area.
- Each pixel can belong to only one semantic class at a time.
- Do not render mutually exclusive semantic classes on top of each other as if they could overlap.
- Respect existing label semantics:
  - Sapwood
  - Heartwood
  - Cu / Copper
  - Background
  - Unknown if modeled
- Overlay should be visible but not obscure the source image completely.
- Active slice selection outline should remain visible on top.

Important semantic invariant:

```text
A pixel must not be displayed as both sapwood and heartwood at the same time.
A pixel must not be displayed as multiple semantic labels at the same time.
```

If the underlying mask uses indexed labels, render the indexed label directly. Do not combine per-class alpha layers in a way that visually creates multi-label overlap.

### 5. Show support mask overlay/contour after confirmation

After a support mask is confirmed for a slice, show it in the navigator as a clear line/contour.

Requirements:

- Support mask should be shown as a line/outline, not as a filled semantic mask.
- Use a distinct, clearly visible support color.
- The support line should appear within/around the relevant BBox area.
- Keep the BBox border visible separately.
- For Sapwood/Heartwood slices, the support mask is derived from the outline of the merged semantic foreground masks.

Expected support outline logic for Sapwood/Heartwood:

```text
supportForeground = sapwoodMask OR heartwoodMask
supportContour = outline(supportForeground)
```

For Cu/Support workflows, use the existing support mask if it is explicitly stored/confirmed.

Important:

- Do not change how support masks are stored.
- This is navigator rendering only.
- If support contour derivation already exists elsewhere, reuse/mirror that logic.
- If it does not exist, implement a small client-side contour extraction only for navigator visualization, without changing persisted masks.

### 6. BBox visual state when masks exist

When a semantic/support overlay exists, the BBox should no longer dominate visually.

Requirement:

- BBox should be shown as a simple outline only.
- Do not fill the BBox with a color.
- Do not place number labels.
- The overlay communicates annotation state.
- The active/selected BBox may still have a stronger outline.

### 7. Empty/unannotated state

For slices without confirmed semantic/support masks:

- show BBox outline only
- no semantic overlay
- no support contour
- optionally use muted stroke to indicate unannotated/incomplete state

This makes annotated vs. unannotated slices visually distinguishable.

## Visual style

Use the existing SaPen Annotate / SaPen Core dark editor style:

- navigator panel remains compact
- image uses available width efficiently
- overlays are crisp and readable
- BBox outlines are visible but not noisy
- no number badges
- no large legend unless necessary
- no extra slice cards/list below the navigator
- no additional vertical space waste

## Data / API considerations

Codex should first inspect what data is already available to the navigator:

- BBox geometry
- active slice id/index
- semantic mask status
- semantic mask image/data
- support mask status
- support mask image/data
- crop coordinates
- image natural size

If confirmed semantic/support mask data is not currently available to the navigator:

- Prefer passing existing data from the editor page/client if already loaded.
- Avoid heavy new backend work in this ticket.
- If a small read-only API addition is required and clearly safe, document it.
- If mask data cannot be loaded without a larger architecture change, implement the auto-fit and BBox-click parts now, then document a follow-up for overlay data wiring.

## Functional boundaries

Do not change:

- BBox storage format
- BBox coordinates
- crop storage format
- semantic mask storage format
- support mask storage format
- label IDs
- commit/autosave contracts
- Core handoff contracts
- editor canvas drawing behavior
- BBox editing behavior
- mask editing behavior

This ticket is about navigator rendering and navigator selection behavior.

## Acceptance criteria

### Auto-fit

- [ ] After BBox confirmation, navigator view is cropped/zoomed to the padded union of BBoxes.
- [ ] Navigator uses available space better and shows minimal irrelevant background.
- [ ] No BBox is clipped.
- [ ] Full-image fallback works if no BBoxes exist.

### BBox display/navigation

- [ ] BBoxes remain clearly visible.
- [ ] Number labels inside BBoxes are removed.
- [ ] Active/current BBox has clear selected outline.
- [ ] Clicking inside a BBox selects/navigates to that slice.
- [ ] No separate slice number UI is required for navigation.

### Semantic overlay

- [ ] Confirmed semantic masks are shown in the navigator as per-pixel overlays.
- [ ] Semantic labels are rendered as mutually exclusive indexed labels.
- [ ] Pixels are not visually shown as multiple semantic classes at once.
- [ ] Overlay colors match or clearly correspond to editor label colors.

### Support overlay

- [ ] Confirmed support masks are shown as contours/lines.
- [ ] For Sapwood/Heartwood, support contour is derived from the outline of merged sapwood + heartwood foreground when appropriate.
- [ ] Support contour is visually distinct and readable.
- [ ] BBox remains visible as outline only.

### Regression

- [ ] Main editor canvas behavior is unchanged.
- [ ] BBox editor behavior is unchanged.
- [ ] Semantic/support editing behavior is unchanged.
- [ ] Existing save/commit behavior is unchanged.
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

1. Open image editor with confirmed BBoxes.
2. Verify navigator auto-fits to BBox union and minimizes background.
3. Verify BBoxes are visible without number labels.
4. Click inside a BBox in the navigator.
5. Verify active slice changes.
6. Confirm/create a semantic mask for a slice.
7. Verify semantic overlay appears in navigator.
8. Confirm/create a support mask.
9. Verify support contour appears in navigator.
10. Verify BBox is shown as outline only when overlay exists.
11. Verify unannotated slices show BBox outline only.
12. Verify canvas editing still works.
13. Verify save/commit still works.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement DESIGN-009: Editor Navigator Auto-Fit and Annotation Overlay State.

Goal:
Make the right-side navigator useful as an annotation overview:
- auto-fit/zoom navigator image to the union of confirmed/current BBoxes
- show BBoxes clearly but remove visible number labels
- allow navigation by clicking inside BBoxes
- show confirmed semantic masks as per-pixel overlays
- show confirmed support masks as contours/lines
- keep BBox only as an outline when masks are displayed

Important:
Use ../sapen only as read-only reference. Search SaPen Core/Refine for fit-to-bounds, overview/navigator, and mask overlay rendering helpers, but do not port large editor logic or change storage contracts.

Implementation details:
1. Compute padded union bounds of all confirmed/current BBoxes.
2. Render navigator using this viewport/crop while preserving aspect ratio.
3. Remove visible number badges from BBoxes.
4. Make BBox areas clickable for slice navigation.
5. Render semantic masks as indexed-label overlays, preserving mutual exclusivity of labels per pixel.
6. Render support masks as contours/lines.
7. For Sapwood/Heartwood slices, derive support contour from the outline of merged sapwood + heartwood foreground when appropriate.
8. If mask data is not available to the navigator, implement auto-fit and clickable BBoxes first, then document a follow-up for overlay data wiring.

Do not change:
- BBox storage or coordinates
- mask storage format
- label IDs
- commit/autosave contracts
- Core handoff contracts
- main canvas behavior
- BBox editor behavior
- semantic/support editing behavior

Run:
- npm run typecheck
- npm run lint
- npm run build
- npm test if appropriate

Report:
A. What changed
B. Files changed
C. How navigator auto-fit bounds are computed
D. How BBox click navigation works
E. How semantic overlays are rendered
F. How support contours are rendered
G. Whether mask data was already available or follow-up is needed
H. Validation results
```

## Suggested commit message

```text
Enhance editor navigator with autofit and mask overlays
```
