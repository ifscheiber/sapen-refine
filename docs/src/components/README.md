# src/components

## Purpose

`src/components` contains reusable UI pieces and the current MVP editor UI used by SaPen Annotate.

## Important Files

- `src/components/AnnotationCanvas.tsx` - canvas drawing and viewport behavior.
- `src/components/EditorToolsBar.tsx` - editor tool controls.
- `src/components/TabSidebar.tsx` - current project/image/sidebar panels.
- `src/components/AppFooter.tsx` - application footer.
- `src/components/ui/*` - reusable UI primitives.

## Public Interfaces / Routes / Functions

These components are consumed by `src/app/app/AppShell.tsx` and editor pages under `src/app/app/projects/[projectId]/images/[imageId]/edit`.

## Invariants And Constraints

- Tablet and desktop layouts should remain usable across viewport sizes.
- Editor controls must preserve annotation state and not bypass backend mask-version invariants.
- Components should not become the only source of domain validation.

## Known Gaps

- Editor state is still heavily client-side.
- iPad/Pencil-specific ergonomics are planned but not implemented.
- Prototype editor warnings remain and are tracked as cleanup debt.

## Related Tickets / Docs

- [editor.md](editor.md)
- [../../workflows/annotation-from-scratch.md](../../workflows/annotation-from-scratch.md)
