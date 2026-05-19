# Editor Feature

The current editor is prototype-level but useful for drawing and saving masks. RB-045 established the browser/iPad trial baseline before domain expansion.

Important files:

- `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx`
- `src/features/editor/EditImagePage.tsx`
- `src/features/editor/EditorClient.tsx`
- `src/features/editor/canvasGeometry.ts`
- `src/design/editorCanvas.ts`
- `src/mask/*`

## Current Entry Route

- Browser route: `/app/projects/[projectId]/images/[imageId]/edit`.
- Route wrapper: `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx`.
- Server composition/RBAC: `src/features/editor/EditImagePage.tsx`.
- Client editor surface: `src/features/editor/EditorClient.tsx`.

## Current Canvas And Input Model

- The editor loads the source image through `/api/images/[imageId]/view`.
- Three canvases are stacked: base image, mask overlay, and lasso preview.
- The mask coordinate space currently matches the image pixel dimensions.
- Pointer Events are the only drawing input layer; there is no parallel mouse/touch event system.
- The overlay canvas uses `touch-none`, so drawing on the canvas is intended not to scroll the page on touch devices.
- Pointer capture is already used for brush strokes, freehand lasso, and polygon-handle dragging.
- Coordinate conversion and fit/zoom sizing helpers live in `src/features/editor/canvasGeometry.ts` and are covered by unit tests.
- RB-045 ignores non-primary touch/stylus pointers and non-left mouse buttons for drawing.
- RB-045 handles `pointercancel` separately from `pointerup`: brush strokes are finalized, freehand lasso is cancelled instead of committed, and polygon dragging is safely released.
- The editor canvas container uses overscroll containment; touch scrolling should remain available outside the drawing surface.

## Current Save And History Model

- Brush and lasso operations write to a `MaskBuffer` in memory.
- Undo/redo stores patch arrays in refs and applies patches back into the mask buffer.
- Autosave debounces dirty mask writes after edits.
- RB-045 exposes dirty/saving state in the editor toolbar and guards browser unload while unsaved edits exist.
- If edits happen while a save is in flight, the editor tracks dirty revisions and queues another save instead of clearing the newer dirty state.
- Manual save uploads raw `u8raw-v1` bytes through `/api/images/[imageId]/mask/upload`.
- Latest saved mask metadata is loaded from `/api/images/[imageId]/mask/latest`; the mask bytes are fetched through an app-mediated version asset URL.

## Current Domain Model

- The editor currently edits one semantic byte mask for the image.
- The active label set comes from `src/mask/labels.ts`; the label schema is not persisted.
- Current saves create `AnnotationArtifactVersion` rows under a default `AnnotationArtifact` with `AnnotationArtifactKind.SEMANTIC_MASK`.
- `MaskKind.REFINED` is removed from the schema; current browser saves are draft human semantic annotation artifacts.
- The editor does not yet distinguish draft, submitted, approved, rejected, or superseded ground-truth state.
- The editor does not yet manage annotation tasks, slice classifications, support/instance geometry, review comments, or export readiness.
- Copper is currently available as a semantic material label. It is not a slice support mask and must not be used as a proxy for physical slice geometry.

## Desktop Browser Smoke Scope

- The supported MVP smoke path is: open editor, draw with brush, save, reload, and confirm the latest mask loads.
- RB-047 browser automation should keep this path small and avoid asserting unstable visual details.

## RB-045 Start Limitations

- Hook dependency warnings in `src/features/editor/EditorClient.tsx` were resolved during RB-045.
- RB-045 increased core tool/action/label touch targets for iPad browser use.
- Advanced iPad gestures such as two-finger zoom/pan are not part of the current editor model.
- Real iPad Safari validation is deferred in RB-047 until deployment/device access is available.

Editor ownership remains under `src/features/editor` without a full editor rewrite.
