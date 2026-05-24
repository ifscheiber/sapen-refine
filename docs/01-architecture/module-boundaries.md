# Module Boundaries

Ownership after RB-043:

- `src/app` - thin route composition, route groups, layouts, and API route handlers.
- `src/components/ui` - generic primitive UI components.
- `src/components/shell` - reusable authenticated workspace shell.
- `src/features` - feature-specific UI and workflow composition.
- `src/server` - server-only database, auth, RBAC, and storage helpers.
- `src/mask` - mask buffers, labels, serialization, patching, and rendering helpers.
- `src/design` - CSS tokens, themes, and design-system notes.

Routes must not become the only place where feature behavior lives. Server-only helpers must not import client components.

Large modules should be decomposed only opportunistically when a feature or bug fix already touches that area. The current hotspot inventory and future extraction slices are tracked in [opportunistic-decomposition-map.md](opportunistic-decomposition-map.md).
