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
- annotation labels,
- typography, radius, and shadow.

Production components should consume tokens through semantic Tailwind classes. Raw hex/RGB values are limited to `src/design/**` and label definitions.
