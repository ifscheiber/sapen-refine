# Editor Components

## Purpose

The current editor lets users view an uploaded image, draw source-image BBox slice proposals, generate derived slice crop previews, draw and erase semantic/support mask overlays, save serialized mask versions, set slice classification, review the MVP ground-truth state, and edit crop support masks. RB-045 established the desktop and iPad browser readiness baseline; RB-052 adds review controls; RB-086 adds BBox proposal mode; RB-087 adds derived crop generation/preview; RB-088 adds the crop support editor; RB-095 adds the whole-image crop slice navigator; RB-103 adds BBox-stage re-entry from crop editors.

## Important Files

- `src/features/editor/EditImagePage.tsx` - server-side full-image editor route composition and RBAC check.
- `src/features/editor/ImageCropBBoxesPage.tsx` - RB-094 staged image-level BBox route composition using the editor canvas in BBox-stage mode.
- `src/features/editor/ImageCropSlicesPage.tsx` and `src/features/editor/ImageCropSliceNavigatorClient.tsx` - RB-095 whole-image slice navigator with BBox overlays, selected-slice URL state, status badges, and crop generation/regeneration action.
- `src/features/editor/EditorClient.tsx` - client-side editor surface, canvas rendering, mask save/reload, slice classification, review controls, and local PNG export.
- `src/features/editor/CropSupportEditorPage.tsx` and `src/features/editor/CropSupportEditorClient.tsx` - crop support editor composition and crop-sized binary support mask editing.
- `src/features/editor/CropSemanticEditorPage.tsx` and `src/features/editor/CropSemanticEditorClient.tsx` - crop semantic editor composition, mode-aware support policy, crop-sized semantic mask editing, and classification/review controls.
- `src/features/editor/CropEditorSliceNavigatorRailClient.tsx` - embedded right-rail slice navigation and BBox-stage re-entry action for crop editors.
- `src/features/editor/cropMaskOperations.ts` - shared crop editor brush/polygon helpers, including Copper support-constrained mutations.
- `src/features/editor/canvasGeometry.ts` - tested helper functions for fit zoom, display size, and pointer-to-image coordinate mapping.
- `src/features/editor/editorTools.ts` - editor tool helpers, including eraser mode/value mapping.
- `src/features/editor/components/EditorBBoxPanel.tsx` - BBox proposal list, selection, replacement/delete controls, BBox set confirmation/unlock controls, derived crop generation, and crop preview.
- `src/design/editorCanvas.ts` - central preview styling constants for lasso handles and polygon previews.
- `src/mask/serialize.ts` - mask byte serialization used by saves.

## Public Interfaces / Routes / Functions

- Browser route: `/app/projects/[projectId]/images/[imageId]/edit`.
- Crop workflow BBox stage route: `/app/projects/[projectId]/images/[imageId]/crop/bboxes`.
- Crop workflow slice navigator route: `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]`.
- Crop support route: `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support`.
- Crop semantic route: `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic`.
- Mask APIs: `/api/images/[imageId]/mask/presign`, `/api/images/[imageId]/mask/commit`, `/api/images/[imageId]/mask/latest`.
- Support/classification APIs: `/api/images/[imageId]/support-mask/*`, `/api/images/[imageId]/slice/*`.
- BBox proposal APIs: `/api/images/[imageId]/slice-bboxes`, `/api/slice-bboxes/[bboxVersionId]`.
- Derived crop APIs: `/api/images/[imageId]/slice-crops`, `/api/slice-bboxes/[bboxVersionId]/crop`, `/api/slice-crops/[cropId]/asset`.
- Crop support APIs: `/api/slice-crops/[cropId]/support-mask`, `/api/slice-crops/[cropId]/support-mask/upload`.
- Review APIs: `/api/images/[imageId]/review-state`, `/api/artifact-versions/[versionId]/review`, `/api/slice-classification-versions/[versionId]/review`.

## Current Input And Canvas Behavior

- The base image canvas, overlay canvas, and preview canvas share the image's natural pixel dimensions.
- CSS display size is controlled by the current zoom value and fit-to-container logic.
- Pointer-to-image mapping uses the overlay canvas bounding rect and canvas backing dimensions via `src/features/editor/canvasGeometry.ts`.
- Brush, Eraser, freehand lasso, and polygon lasso all use Pointer Events.
- Crop support and crop semantic editors expose Brush, Eraser, freehand lasso, polygon lasso, undo/redo, fit, zoom, reload, opacity, and save controls against crop-pixel masks. BBox proposal drawing remains limited to the full-image/BBox-stage editor.
- Crop semantic Brush and lasso operations are mode-aware: Sap/Heartwood edits are unconstrained and use semantic foreground as support geometry, while Copper edits are clipped to explicit support when a support mask exists. Copper drafts can be edited before support exists, but readiness/export still requires approved explicit support.
- BBox proposal drawing also uses Pointer Events and stores integer source-image pixel rectangles.
- Crop support and semantic editor headers and the embedded slice navigator rail expose `Edit BBoxes`, linking back to `/crop/bboxes` instead of the legacy full-image editor route.
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
- Confirming a BBox set records workflow state only and does not approve BBoxes as support geometry.
- Re-entering the BBox stage after confirmation must keep BBoxes locked until the user explicitly unlocks editing; any resulting mutation requires re-confirmation.
- Review actions must use server APIs; UI control hiding is not the permission boundary.
- Canvas scaling and coordinate assumptions must be explicit before production iPad/Pencil work.
- Editor UX should support desktop and tablet screen sizes.
- Default full-image mask coordinates remain tied to the source image dimensions. BBox proposals use `SOURCE_IMAGE_PIXEL`; derived crops, crop support masks, and crop semantic masks use `CROP_PIXEL`; default semantic/support masks still use `IMAGE_PIXEL`.

## Known Gaps

- Undo/redo, autosave, and canvas rendering need focused validation.
- RB-045 resolved the previous editor hook dependency warnings.
- iPad Safari and Apple Pencil behavior has a manual smoke checklist planned in RB-045.
- Advanced multi-touch zoom/pan remains deferred.
- Review controls are minimal; reviewer dashboards, bulk review, and multi-reviewer policy are deferred.
- BBox proposals and derived crops are crop-planning/editing artifacts only. Crop support-mask editing, crop semantic editing, crop semantic classification suggestion/override controls, and crop readiness/review controls exist. Reviewer dashboards and bulk review remain deferred.

## Related Tickets / Docs

- [../mask/README.md](../mask/README.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
