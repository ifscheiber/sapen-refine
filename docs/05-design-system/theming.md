# Theming

RB-043 establishes CSS-variable theming through `src/design`.

Light and dark readiness is token-driven. Components should use semantic classes such as `bg-background`, `text-foreground`, `border-border`, and shell/annotation token names.

`src/app/globals.css` imports:

- Tailwind CSS,
- `src/design/tokens.css`,
- `src/design/themes.css`.

Theme-specific raw values should stay in `src/design/**`.
