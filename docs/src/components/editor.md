# Editor Components

## Purpose

The current editor surfaces support the crop workflow and assisted correction. Users draw source-image BBox slice proposals in the BBox stage, generate derived slice crop previews, edit crop support/semantic masks in one unified crop annotation editor, classify/review crop artifacts, and correct prediction-backed tasks. RB-104 removed the legacy full-image annotation route. RB-123 removed the intermediate crop workbench screen.

## Important Files

- `src/features/editor/ImageCropBBoxesPage.tsx` - RB-094 staged image-level BBox route composition using the editor canvas in BBox-stage mode.
- `src/features/editor/ImageCropSlicesPage.tsx` and `src/features/editor/ImageCropSliceNavigatorClient.tsx` - RB-095 whole-image slice navigator with BBox overlays, selected-slice URL state, status badges, and crop generation/regeneration action.
- `src/features/editor/EditorClient.tsx` - shared full-image canvas surface for BBox-stage planning and assisted correction only.
- `src/features/editor/AnnotationEditorWorkspace.tsx` - shared Core-aligned editor shell, header, context row, local tabs, and optional navigator rail for BBox and crop-mask editor routes.
- `src/features/editor/CropSemanticEditorPage.tsx` and `src/features/editor/CropSemanticEditorClient.tsx` - Core-aligned unified crop annotation editor composition, compact editor header/context rows, polygon-first mask tools, mode-aware support policy, annotation-family lock guardrails, crop support-mask editing, crop semantic-mask editing, derived classification status, and review controls.
- `src/features/editor/CropEditorSliceNavigatorRailClient.tsx` - navigator-only embedded right rail showing slice counts and the whole-image overview for crop editors.
- `src/features/editor/cropMaskOperations.ts` - shared crop editor brush/polygon helpers, including Copper support-constrained mutations.
- `src/features/editor/canvasGeometry.ts` - tested helper functions for fit zoom, display size, pointer-to-image coordinate mapping, and BBox hit/move/resize geometry.
- `src/features/editor/editorTools.ts` - editor tool helpers, including eraser mode/value mapping.
- `src/features/editor/components/EditorBBoxPanel.tsx` - BBox-stage tools-only toolbar, canvas-based BBox selection, add/select-resize/delete controls, zoom/fit controls, separate BBox status/workflow strips, derived crop generation, and crop preview.
- `src/design/editorCanvas.ts` - central preview styling constants for lasso handles and polygon previews.
- `src/mask/serialize.ts` - mask byte serialization used by saves.

## Public Interfaces / Routes / Functions

- Crop workflow entry route: `/app/projects/[projectId]/images/[imageId]/crop`.
- Crop workflow BBox stage route: `/app/projects/[projectId]/images/[imageId]/crop/bboxes`.
- Crop workflow slice navigator route: `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]`.
- Unified crop annotation editor route: `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]`.
- Crop workflow support route alias: `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/support`.
- Crop workflow semantic route alias: `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic`.
- Crop support compatibility alias: `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support`.
- Crop semantic compatibility alias: `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic`.
- Full-image mask APIs: `/api/images/[imageId]/mask/upload`, `/api/images/[imageId]/mask/latest`; the legacy `/mask/presign` and `/mask/commit` routes remain present but disabled with `PRESIGNED_UPLOADS_DISABLED` and no longer back editor saves.
- Support/classification APIs: `/api/images/[imageId]/support-mask/*`, `/api/images/[imageId]/slice/*`.
- BBox proposal APIs: `/api/images/[imageId]/slice-bboxes`, `/api/slice-bboxes/[bboxVersionId]`.
- Derived crop APIs: `/api/images/[imageId]/slice-crops`, `/api/slice-bboxes/[bboxVersionId]/crop`, `/api/slice-crops/[cropId]/asset`.
- Crop support APIs: `/api/slice-crops/[cropId]/support-mask`, `/api/slice-crops/[cropId]/support-mask/upload`.
- Review APIs: `/api/images/[imageId]/review-state`, `/api/artifact-versions/[versionId]/review`, `/api/slice-classification-versions/[versionId]/review`.

## Current Input And Canvas Behavior

- The base image canvas, overlay canvas, and preview canvas share the image's natural pixel dimensions.
- CSS display size is controlled by the current zoom value and fit-to-container logic.
- Pointer-to-image mapping uses the overlay canvas bounding rect and canvas backing dimensions via `src/features/editor/canvasGeometry.ts`.
- Brush, freehand Lasso, Polygon, and polygon vertex adjustment all use Pointer Events.
- The unified crop annotation editor exposes a polygon-first tool surface with Polygon, Lasso, Brush, Background label clearing, undo/redo, fit, zoom, reload, opacity, commit mask, derived classification status, and review controls against crop-pixel masks. DESIGN-014 removed the local Classification tab and manual crop-editor classification save controls; crop semantic saves still create draft auto-derived classification versions that must be reviewed for export readiness. BBox proposal drawing remains limited to the BBox-stage source-image canvas. The editor keeps the opposite annotation family unavailable while the active family has foreground pixels.
- Crop semantic Brush and lasso operations are mode-aware: Sap/Heartwood edits are unconstrained and use semantic foreground as support geometry, while Copper edits are clipped to explicit support when a support mask exists. Copper drafts can be edited before support exists, but readiness/export still requires approved explicit support.
- BBox proposal editing also uses Pointer Events and stores integer source-image pixel rectangles. In BBox-stage mode the toolbar exposes only Add BBox, Select/Edit, Resize, Delete, Zoom, and Fit controls. Selection/move/resize happen directly on the source-image canvas; protected BBoxes can still be selected but cannot be deleted or geometry-edited. BBox counts, overlap/protection warnings, `Prepare slices`, `Open slice annotation`, and `Unlock BBox editing` live outside the tool row. The BBox stage uses the same `Annotation Editor` shell and local tab row as crop semantic/support editing.
- The unified editor tab row exposes `BBoxes`, linking back to `/crop/bboxes` instead of the legacy full-image editor route. The embedded right rail stays navigator-only by default.
- Old support/semantic crop routes redirect into the unified editor with the requested initial target.
- `Background` is the primary clearing concept. Users select the Background label and apply it with Polygon, Lasso, or Brush.
- The legacy eraser mapping remains internal compatibility logic only; it writes semantic background in `Semantic mask` mode and support background in `Slice support` mode.
- The drawing canvas is expected to suppress page scroll while drawing; page scroll should remain available outside the canvas container.
- `pointercancel` is handled as an interruption, not as a normal lasso completion.
- Non-primary touch/stylus pointers and non-left mouse buttons are ignored for drawing.
- Core tool/action/label controls use larger touch targets for iPad browser use.
- Dirty and saving state is visible in the toolbar; browser unload is guarded while unsaved edits exist.

## Invariants And Constraints

- Saving a mask must create a new version rather than overwrite a historical artifact.
- Replacing or deleting a BBox proposal must append a new BBox version rather than overwrite historical proposal geometry.
- Active BBox proposals must not overlap. Overlap issues block confirmation and continuation.
- BBoxes with semantic mask, support/instance mask, or classification versions must not be deleted or geometry-edited without a future explicit destructive dependency-removal flow.
- Confirming a BBox set records workflow state only and does not approve BBoxes as support geometry.
- Re-entering the BBox stage after confirmation must keep BBoxes locked until the user explicitly unlocks editing; any resulting mutation requires re-confirmation.
- Review actions must use server APIs; UI control hiding is not the permission boundary.
- Canvas scaling and coordinate assumptions must be explicit before production iPad/Pencil work.
- Editor UX should support desktop and tablet screen sizes.
- BBox proposals use `SOURCE_IMAGE_PIXEL`; derived crops, crop support masks, and crop semantic masks use `CROP_PIXEL`. Historical/default full-image mask APIs still use `IMAGE_PIXEL`, but the legacy product route was removed by RB-104.

## Known Gaps

- Undo/redo, autosave, and canvas rendering need focused validation.
- RB-045 resolved the previous editor hook dependency warnings.
- iPad Safari and Apple Pencil behavior has a manual smoke checklist planned in RB-045.
- Advanced multi-touch zoom/pan remains deferred.
- Review controls are minimal; reviewer dashboards, bulk review, and multi-reviewer policy are deferred.
- BBox proposals and derived crops are crop-planning/editing artifacts only. Crop support-mask editing, crop semantic editing, auto-derived classification status/review controls, and crop readiness/review controls exist. Manual crop-editor classification override controls are removed from the product UI; reviewer dashboards and bulk review remain deferred.

## Related Tickets / Docs

- [../mask/README.md](../mask/README.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
