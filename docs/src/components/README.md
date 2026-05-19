# src/components

## Purpose

`src/components` contains reusable UI pieces used by SaPen Annotate. Feature-specific UI lives under `src/features`.

## Important Files

- `src/components/ui/*` - reusable UI primitives.
- `src/components/shell/*` - authenticated workspace shell components.
- `src/components/LogoutButton.tsx` - logout action shared by shell variants.

## Public Interfaces / Routes / Functions

These components are consumed by route layouts under `src/app/(workspace)/app` and feature modules under `src/features`.

## Invariants And Constraints

- Tablet and desktop layouts should remain usable across viewport sizes.
- Editor controls must preserve annotation state and not bypass backend mask-version invariants.
- Components should not become the only source of domain validation.

## Known Gaps

- Editor state is still heavily client-side in `src/features/editor/EditorClient.tsx`.
- iPad/Pencil-specific ergonomics are planned but not implemented.
- Prototype editor warnings remain and are tracked as cleanup debt.

## Related Tickets / Docs

- [editor.md](editor.md)
- [../../workflows/annotation-from-scratch.md](../../workflows/annotation-from-scratch.md)
