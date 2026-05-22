# Editor Components

## Purpose

The current editor lets users view an uploaded image, draw source-image BBox slice proposals, draw and erase semantic/support mask overlays, save serialized mask versions, set slice classification, and review the MVP ground-truth state. RB-045 established the desktop and iPad browser readiness baseline; RB-052 adds review controls; RB-086 adds BBox proposal mode.

## Important Files

- `src/features/editor/EditImagePage.tsx` - server-side route composition and RBAC check.
- `src/features/editor/EditorClient.tsx` - client-side editor surface, canvas rendering, mask save/reload, slice classification, review controls, and local PNG export.
- `src/features/editor/canvasGeometry.ts` - tested helper functions for fit zoom, display size, and pointer-to-image coordinate mapping.
- `src/features/editor/editorTools.ts` - editor tool helpers, including eraser mode/value mapping.
- `src/features/editor/components/EditorBBoxPanel.tsx` - BBox proposal list, selection, replacement, and delete controls.
- `src/design/editorCanvas.ts` - central preview styling constants for lasso handles and polygon previews.
- `src/mask/serialize.ts` - mask byte serialization used by saves.

## Public Interfaces / Routes / Functions

- Browser route: `/app/projects/[projectId]/images/[imageId]/edit`.
- Mask APIs: `/api/images/[imageId]/mask/presign`, `/api/images/[imageId]/mask/commit`, `/api/images/[imageId]/mask/latest`.
- Support/classification APIs: `/api/images/[imageId]/support-mask/*`, `/api/images/[imageId]/slice/*`.
- BBox proposal APIs: `/api/images/[imageId]/slice-bboxes`, `/api/slice-bboxes/[bboxVersionId]`.
- Review APIs: `/api/images/[imageId]/review-state`, `/api/artifact-versions/[versionId]/review`, `/api/slice-classification-versions/[versionId]/review`.

## Current Input And Canvas Behavior

- The base image canvas, overlay canvas, and preview canvas share the image's natural pixel dimensions.
- CSS display size is controlled by the current zoom value and fit-to-container logic.
- Pointer-to-image mapping uses the overlay canvas bounding rect and canvas backing dimensions via `src/features/editor/canvasGeometry.ts`.
- Brush, Eraser, freehand lasso, and polygon lasso all use Pointer Events.
- BBox proposal drawing also uses Pointer Events and stores integer source-image pixel rectangles.
- Eraser is a brush-shaped tool. It uses the same size control as Brush, writes semantic background in `Semantic mask` mode, and writes support background in `Slice support` mode.
- The `Background` label remains selectable; explicit Eraser is a discoverability and repeated-workflow improvement.
- The drawing canvas is expected to suppress page scroll while drawing; page scroll should remain available outside the canvas container.
- `pointercancel` is handled as an interruption, not as a normal lasso completion.
- Non-primary touch/stylus pointers and non-left mouse buttons are ignored for drawing.
- Core tool/action/label controls use larger touch targets for iPad browser use.
- Dirty and saving state is visible in the toolbar; browser unload is guarded while unsaved edits exist.

## Invariants And Constraints

- Saving a mask must create a new version rather than overwrite a historical artifact.
- Replacing or deleting a BBox proposal must append a new BBox version rather than overwrite historical proposal geometry.
- Review actions must use server APIs; UI control hiding is not the permission boundary.
- Canvas scaling and coordinate assumptions must be explicit before production iPad/Pencil work.
- Editor UX should support desktop and tablet screen sizes.
- Mask coordinates must remain tied to the source image dimensions until a documented coordinate-space change is made. BBox proposals use `SOURCE_IMAGE_PIXEL`; semantic/support masks still use `IMAGE_PIXEL`.

## Known Gaps

- Undo/redo, autosave, and canvas rendering need focused validation.
- RB-045 resolved the previous editor hook dependency warnings.
- iPad Safari and Apple Pencil behavior has a manual smoke checklist planned in RB-045.
- Advanced multi-touch zoom/pan remains deferred.
- Review controls are minimal; reviewer dashboards, bulk review, and multi-reviewer policy are deferred.
- BBox proposals are implemented as crop-planning artifacts only; crop generation and crop support-mask editing remain deferred.

## Related Tickets / Docs

- [../mask/README.md](../mask/README.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
