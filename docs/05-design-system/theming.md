# Theming

RB-043 establishes CSS-variable theming through `src/design`.

Light and dark readiness is token-driven. Components should use semantic classes such as `bg-background`, `text-foreground`, `border-border`, and shell/annotation token names.

`src/app/globals.css` imports:

- Tailwind CSS,
- `src/design/tokens.css`,
- `src/design/themes.css`.

Theme-specific raw values should stay in `src/design/**`.

The DESIGN-001 login page uses an additive dark shell token set in `src/design/tokens.css` to mirror SaPen Core surfaces and controls locally. These tokens are consumed through scoped classes on `src/app/(public)/login/LoginForm.tsx`, so the annotation editor, canvas preview colors, mask label colors, and authenticated workspace theme are not globally redesigned by the login update.
