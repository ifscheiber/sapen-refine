# Editor Components

## Purpose

The current editor lets users view an uploaded image, draw semantic mask overlays, save a serialized mask version, and reload the latest mask.

## Important Files

- `src/features/editor/EditImagePage.tsx` - server-side route composition and RBAC check.
- `src/features/editor/EditorClient.tsx` - client-side editor surface, canvas rendering, mask save/reload, and export.
- `src/design/editorCanvas.ts` - central preview styling constants for lasso handles and polygon previews.
- `src/mask/serialize.ts` - mask byte serialization used by saves.

## Public Interfaces / Routes / Functions

- Browser route: `/app/projects/[projectId]/images/[imageId]/edit`.
- Mask APIs: `/api/images/[imageId]/mask/presign`, `/api/images/[imageId]/mask/commit`, `/api/images/[imageId]/mask/latest`.

## Invariants And Constraints

- Saving a mask must create a new version rather than overwrite a historical artifact.
- Canvas scaling and coordinate assumptions must be explicit before production iPad/Pencil work.
- Editor UX should support desktop and tablet screen sizes.

## Known Gaps

- Undo/redo, autosave, and canvas rendering need focused validation.
- ESLint still reports non-blocking hook dependency warnings in `src/features/editor/EditorClient.tsx`.
- Review/approval state is not part of the editor workflow yet.

## Related Tickets / Docs

- [../mask/README.md](../mask/README.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
