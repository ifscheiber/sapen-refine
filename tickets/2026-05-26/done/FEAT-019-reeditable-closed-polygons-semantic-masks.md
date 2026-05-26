# FEAT-019 — Re-Editable Closed Polygon Shapes for Semantic Masks

## Status

Done

## Type

Editor UX / polygon editing / mask provenance ticket

## Target repository

Work in the `sapen-annotate` repository.

## Reference repository path

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only reference. Do not import directly from `../sapen` at runtime unless the repository is intentionally configured for this.

## Background

Current annoyance:

After the user closes/applies a semantic polygon mask, the polygon’s definition points are no longer available by clicking into the mask. This makes it hard to correct a polygon after noticing that one or more vertices should be moved.

This is a real UX problem because polygon drawing is the primary annotation tool. Users need to be able to refine a closed polygon without redrawing the entire mask.

## Important technical clarification

If a polygon is immediately rasterized into a pixel mask and only the raster mask is stored, the original polygon definition points cannot be recovered exactly later.

Therefore, the correct solution is **not** to “guess” vertices from the raster mask as the primary mechanism.

The editor should keep or persist the vector definition of polygon/lasso operations where possible:

```text
polygon points / shape operation → rasterized mask result
```

The raster mask remains the authoritative mask for export/storage, but editable polygon geometry should remain available for correction as long as it is safe and meaningful.

## Goal

Allow users to re-select a closed semantic polygon by clicking into the corresponding mask/shape and then adjust its definition points.

Expected UX:

1. User selects `Polygon`.
2. User draws polygon points.
3. User closes polygon.
4. Polygon remains selectable/editable.
5. User clicks inside the closed polygon/mask area.
6. The polygon’s definition points/handles become visible again.
7. User drags vertices/fixpoints to refine the shape.
8. User applies/updates the polygon.
9. The mask is re-rasterized using the updated polygon geometry.

This should work at least during the current editing session. If safe persistence exists or can be added with low risk, it should also work after reload/commit.

## Relationship to existing tickets

This complements:

```text
DESIGN-003D — Polygon closed-shape vertex adjustment UX
DESIGN-010 — Tools-only BBox toolbar
DESIGN-015 — Support label integration
```

DESIGN-003D focused on moving points immediately after closing. This ticket extends the concept: after the polygon has been applied/closed, clicking the resulting mask/shape should re-select the polygon and show its definition points again, where possible.

## Required reference inspection

Inspect local editor and mask operation code:

```text
src/features/editor/CropSemanticEditorClient.tsx
src/features/editor/CropSemanticEditorPage.tsx
src/features/editor
src/app/app/projects/[projectId]/images/[imageId]
src/lib/projectsClient.ts
src/app/api
```

Search local repo for:

```text
polygon
points
closed polygon
lasso
mask operation
rasterize
apply polygon
commit mask
mask version
provenance
metadata
undo
redo
```

Inspect SaPen Refine reference implementation only as read-only reference:

```text
../sapen/apps/sapen-refine/src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx
../sapen/apps/sapen-refine/src/mask
../sapen/apps/sapen-refine/src/app/app/shell/annotationConfig.ts
```

Search reference repo for:

```text
polygonPoints
dragIndex
points
preview
handles
rasterize
undo
redo
maskVersion
provenance
```

## Implementation strategy

### Phase 1 — In-session re-editing, required

Minimum required behavior:

- Keep closed polygon geometry in editor state after it has been applied.
- Render polygon handles when the polygon/shape is selected.
- Allow selecting the polygon again by clicking inside the shape area.
- Allow vertex dragging after re-selection.
- Re-apply/re-rasterize the polygon after vertices change.
- Preserve undo/redo behavior.

This phase should not require backend/storage changes if the current session already has the polygon points available.

### Phase 2 — Persisted vector provenance, preferred if safe

If the current mask version/provenance model has a safe place for operation metadata, persist polygon/lasso operation geometry with the mask version or draft state.

Possible concept:

```ts
{
  tool: "polygon",
  label: "Sapwood" | "Heartwood" | "Cu" | "Support" | "Background",
  points: Array<{ x: number; y: number }>,
  coordinateSpace: "crop" | "image",
  targetSliceId: string,
  operationId: string,
  appliedAt: string
}
```

Requirements if persisted:

- Do not break existing mask version contracts.
- Use existing metadata/provenance JSON fields if available.
- Do not require a migration unless absolutely necessary.
- Ensure coordinates are stored in the correct coordinate space.
- On reload, restore editable vector overlays only when they can be mapped safely to the current mask.

If persistence would require a larger schema/API change, do not implement it in this ticket. Implement Phase 1 and document a follow-up.

### Phase 3 — Raster contour fallback, optional only

If no vector provenance exists for old masks, the editor may optionally allow “extract approximate contour from raster mask” as a future enhancement.

This is not required for this ticket and should not be the primary solution.

Reason:

- A raster contour does not preserve the original user-defined vertices.
- It can create too many points.
- It may not match the user’s original intent.

## UX requirements

### Selecting a closed polygon

Click behavior:

- clicking inside an editable polygon/mask selects the polygon operation
- selected polygon shows:
  - outline
  - vertex handles/fixpoints
  - active styling
- clicking outside deselects, unless existing UX says otherwise

If multiple editable shapes overlap:

- prefer the most recent operation
- or prefer the active label/family
- document deterministic selection behavior

### Adjusting points

When selected:

- vertices can be dragged
- handles remain visible
- cursor/hover state indicates draggable points
- polygon remains closed during editing
- user can apply/update shape
- user can cancel/revert local adjustment if existing undo/redo supports it

### Updating the mask

When vertices change:

- re-rasterize the updated polygon into the mask
- preserve semantic exclusivity: each pixel has only one semantic label
- if the polygon label is `Background`, updating the polygon clears that region
- if the polygon label is `Support`, follow support-specific rules from DESIGN-015

### Toolbar/state indication

Do not add a large panel.

Use compact state text if needed:

```text
Polygon selected · drag points to adjust
```

or tooltip/help text:

```text
Click a polygon to edit its points.
```

## Constraints and edge cases

### Brush edits

If a region was created or modified by brush, original polygon points do not exist.

Expected behavior:

- clicking a brush-only region should not pretend that polygon points exist
- either no handles appear
- or show compact message: `No editable polygon geometry for this region`

### Mixed edits

If a polygon region was later modified by brush/background/lasso, the stored polygon may no longer perfectly represent the raster mask.

Codex should inspect current undo/operation model.

Safe options:

1. Mark the polygon geometry as stale/non-editable after destructive brush edits.
2. Allow editing only the latest polygon operation, not arbitrary merged mask areas.
3. Re-apply operation order if an operation stack exists.

Do not introduce unsafe behavior that silently corrupts masks.

### Committed masks

If vector provenance is not persisted, re-editing after page reload/commit may not be possible.

Acceptance for this ticket:

- must work in-session after closing/applying polygon
- persisted restore is preferred but may be documented as follow-up if not currently supported

### Support masks

For support masks:

- support is single-mask behavior
- if user re-edits a support polygon, it should replace/update the existing support mask according to DESIGN-015
- warn before replacing a persisted/confirmed support mask if required by existing UX

## Functional boundaries

Do not change:

- label IDs
- mask storage format unless using existing metadata/provenance field
- export format
- Core handoff contracts
- BBox coordinate/storage contracts
- auth/RBAC
- project/image APIs beyond tiny metadata/provenance support if already available

Do not rewrite:

- entire canvas engine
- entire mask rasterizer
- full operation history system

## Acceptance criteria

### Required: in-session behavior

- [ ] After closing/applying a polygon, the polygon geometry remains available in editor state.
- [ ] Clicking inside the polygon/mask re-selects the polygon.
- [ ] Selected polygon shows definition points/vertex handles.
- [ ] User can move vertices after re-selection.
- [ ] Updated polygon re-rasterizes into the mask.
- [ ] Undo/redo remains correct.
- [ ] Background-labeled polygon can be re-edited if it was created as polygon.
- [ ] Brush-only regions do not show fake polygon handles.

### Preferred: persistence if safe

- [ ] Polygon operation geometry is persisted in existing metadata/provenance if available and safe.
- [ ] Reloading an editable draft restores polygon handles where possible.
- [ ] If persistence is not implemented, follow-up is documented.

### Regression

- [ ] Existing polygon drawing still works.
- [ ] Lasso/brush behavior still works.
- [ ] Semantic exclusivity is preserved.
- [ ] Support label behavior remains consistent with DESIGN-015.
- [ ] Mask commit/save still works.
- [ ] No storage/API/handoff regression.

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

1. Open semantic mask editor.
2. Select Polygon.
3. Draw and close polygon for Sapwood/Heartwood/Cu.
4. Click inside the closed polygon.
5. Verify vertices/fixpoints appear.
6. Drag a vertex.
7. Apply/update polygon.
8. Verify mask changes accordingly.
9. Undo and redo.
10. Draw Background polygon.
11. Click it/reselect it if supported and adjust.
12. Use Brush to modify an area.
13. Verify brush-only region does not show fake polygon handles.
14. Save/commit mask.
15. Reload page.
16. If persistence implemented, verify polygon handles restore; otherwise verify documented limitation.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement FEAT-019: Re-Editable Closed Polygon Shapes for Semantic Masks.

Problem:
After closing/applying a semantic polygon mask, the user cannot click the mask to get back the polygon definition points and adjust them. This makes polygon editing frustrating.

Goal:
At least during the current editing session:
- keep polygon geometry after close/apply
- allow clicking inside the resulting polygon/mask to re-select it
- show vertex/fixpoint handles
- allow moving vertices
- re-rasterize the updated polygon into the mask
- preserve undo/redo and semantic exclusivity

Important:
If only a raster mask is stored, original polygon points cannot be recovered exactly. Do not fake original points from raster as the main solution. Keep/persist vector operation geometry where possible.

Preferred if safe:
Persist polygon/lasso operation geometry in existing mask metadata/provenance so editable polygons can be restored after reload. If this requires a larger schema/API change, implement in-session behavior and document follow-up.

Do not change:
- label IDs
- mask storage format unless using an existing metadata/provenance field safely
- export format
- Core handoff contracts
- BBox contracts
- auth/RBAC

Do not rewrite the full canvas engine.

Run:
- npm run typecheck
- npm run lint
- npm run build
- npm test if appropriate

Report:
A. What changed
B. Files changed
C. How polygon geometry is retained
D. How clicking a mask selects the editable polygon
E. How vertex edits re-rasterize masks
F. Whether persistence after reload is supported or deferred
G. Validation results
H. Follow-ups
```

## Suggested commit message

```text
Allow re-editing closed semantic polygons
```
