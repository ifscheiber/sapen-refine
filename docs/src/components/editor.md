# Editor Components

## Purpose

The current editor lets users view an uploaded image, draw semantic mask overlays, save a serialized mask version, and reload the latest mask.

## Important Files

- `src/app/app/AppShell.tsx` - MVP shell that wires project/image state into editor components.
- `src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx` - route-specific editor client.
- `src/components/AnnotationCanvas.tsx` - drawing canvas.
- `src/components/EditorToolsBar.tsx` - brush/tool/opacity controls.
- `src/components/TabSidebar.tsx` - project/image/sidebar panels.
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
- There are current lint/type errors in editor-related files.
- Review/approval state is not part of the editor workflow yet.

## Related Tickets / Docs

- [../mask/README.md](../mask/README.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
