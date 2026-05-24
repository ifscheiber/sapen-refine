# Tokens

Token files:

- `src/design/tokens.css` - light/dark semantic CSS variables.
- `src/design/themes.css` - Tailwind v4 token mapping and base element styles.
- `src/design/editorCanvas.ts` - centrally approved canvas preview colors.

Token groups:

- background and foreground,
- surface/card/popover,
- primary, secondary, accent,
- muted, border, input, ring,
- destructive, warning, success, info,
- shell/sidebar,
- Core-aligned application shell surfaces, login surfaces, borders, text, brand/accent, focus, and warning tokens,
- annotation labels,
- typography, radius, and shadow.

Production components should consume tokens through semantic Tailwind classes. Raw hex/RGB values are limited to `src/design/**` and label definitions.

DESIGN-001 adds a small SaPen Core-aligned token subset for the login shell without replacing the full app theme. The new variables include `--app-background`, `--shell-topbar-bg`, `--workspace-surface`, `--workspace-surface-strong`, `--workspace-input-background`, `--border-subtle`, `--border-default`, `--accent-primary`, `--accent-primary-hover`, `--text-primary`, `--text-secondary`, `--text-muted`, `--brand`, `--brand-hover`, and `--focus-ring`.

DESIGN-002 extends the same local mirror for the authenticated project workspace. The added variables cover contextual sidebar surfaces, workspace panels, hover/selected states, card borders, dim/inverse/info text, readiness markers, and workspace panel shadow. These variables are consumed by `src/components/shell/*`, `src/components/workspace/*`, and the project image workspace.
