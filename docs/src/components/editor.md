# Editor Components

## Purpose

The current editor lets users view an uploaded image, draw semantic mask overlays, save a serialized mask version, and reload the latest mask. RB-045 is the stabilization pass for desktop and iPad browser readiness.

## Important Files

- `src/features/editor/EditImagePage.tsx` - server-side route composition and RBAC check.
- `src/features/editor/EditorClient.tsx` - client-side editor surface, canvas rendering, mask save/reload, and export.
- `src/features/editor/canvasGeometry.ts` - tested helper functions for fit zoom, display size, and pointer-to-image coordinate mapping.
- `src/design/editorCanvas.ts` - central preview styling constants for lasso handles and polygon previews.
- `src/mask/serialize.ts` - mask byte serialization used by saves.

## Public Interfaces / Routes / Functions

- Browser route: `/app/projects/[projectId]/images/[imageId]/edit`.
- Mask APIs: `/api/images/[imageId]/mask/presign`, `/api/images/[imageId]/mask/commit`, `/api/images/[imageId]/mask/latest`.

## Current Input And Canvas Behavior

- The base image canvas, overlay canvas, and preview canvas share the image's natural pixel dimensions.
- CSS display size is controlled by the current zoom value and fit-to-container logic.
- Pointer-to-image mapping uses the overlay canvas bounding rect and canvas backing dimensions via `src/features/editor/canvasGeometry.ts`.
- Brush, freehand lasso, and polygon lasso all use Pointer Events.
- The drawing canvas is expected to suppress page scroll while drawing; page scroll should remain available outside the canvas container.
- `pointercancel` is handled as an interruption, not as a normal lasso completion.
- Non-primary touch/stylus pointers and non-left mouse buttons are ignored for drawing.

## Invariants And Constraints

- Saving a mask must create a new version rather than overwrite a historical artifact.
- Canvas scaling and coordinate assumptions must be explicit before production iPad/Pencil work.
- Editor UX should support desktop and tablet screen sizes.
- Mask coordinates must remain tied to the source image dimensions until a documented coordinate-space change is made.

## Known Gaps

- Undo/redo, autosave, and canvas rendering need focused validation.
- RB-045 resolved the previous editor hook dependency warnings.
- iPad Safari and Apple Pencil behavior has a manual smoke checklist planned in RB-045.
- Advanced multi-touch zoom/pan remains deferred.
- Review/approval state is not part of the editor workflow yet.

## Related Tickets / Docs

- [../mask/README.md](../mask/README.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
