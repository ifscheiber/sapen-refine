# Editor Feature

The current editor is prototype-level but useful for drawing and saving masks. RB-045 is stabilizing it as the browser/iPad trial baseline before domain expansion.

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

## Current Save And History Model

- Brush and lasso operations write to a `MaskBuffer` in memory.
- Undo/redo stores patch arrays in refs and applies patches back into the mask buffer.
- Autosave debounces dirty mask writes after edits.
- Manual save uploads raw `u8raw-v1` bytes through `/api/images/[imageId]/mask/presign`, then commits through `/api/images/[imageId]/mask/commit`.
- Latest saved mask bytes are loaded from `/api/images/[imageId]/mask/latest`.

## RB-045 Start Limitations

- `npm run lint` reports hook dependency warnings in `src/features/editor/EditorClient.tsx`.
- Pointer cancellation is routed to pointer-up handling, but pointer-leave and out-of-bounds coordinate behavior need hardening.
- Touch targets are functional but not yet tuned for iPad use.
- Advanced iPad gestures such as two-finger zoom/pan are not part of the current editor model.

Editor ownership remains under `src/features/editor` without a full editor rewrite.
