# src/components

## Purpose

`src/components` contains reusable UI pieces used by SaPen Annotate. Feature-specific UI lives under `src/features`.

## Important Files

- `src/components/ui/*` - reusable UI primitives.
- `src/components/shell/*` - authenticated workspace shell components.
- `src/components/shell/AppMissingResource.tsx` - reusable missing-resource soft landing with projects, project overview, and task navigation actions.
- `src/components/workspace/*` - SaPen Core-aligned workspace layout, local tabs, contextual rows, utility rail, and sidebar section primitives mirrored locally for SaPen Annotate.
- `src/components/LogoutButton.tsx` - logout action shared by shell variants.

## Public Interfaces / Routes / Functions

These components are consumed by route layouts under `src/app/(workspace)/app` and feature modules under `src/features`.

## Invariants And Constraints

- Tablet and desktop layouts should remain usable across viewport sizes.
- Authenticated workspace pages should use the shell/sidebar/workspace primitives instead of ad hoc project-directory layouts.
- Editor controls must preserve annotation state and not bypass backend mask-version invariants.
- Components should not become the only source of domain validation.

## Known Gaps

- Editor state is still heavily client-side in `src/features/editor/EditorClient.tsx`.
- Advanced iPad/Pencil-specific ergonomics beyond Pointer Events remain deferred.
- The editor now has MVP review controls, but reviewer dashboards and bulk review are not reusable components yet.

## Related Tickets / Docs

- [editor.md](editor.md)
- [../../workflows/annotation-from-scratch.md](../../workflows/annotation-from-scratch.md)
