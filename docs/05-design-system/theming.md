# Theming

RB-043 establishes CSS-variable theming through `src/design`.

Light and dark readiness is token-driven. Components should use semantic classes such as `bg-background`, `text-foreground`, `border-border`, and shell/annotation token names.

`src/app/globals.css` imports:

- Tailwind CSS,
- `src/design/tokens.css`,
- `src/design/themes.css`.

Theme-specific raw values should stay in `src/design/**`.

The DESIGN-001 login page uses an additive dark shell token set in `src/design/tokens.css` to mirror SaPen Core surfaces and controls locally. These tokens are consumed through scoped classes on `src/app/(public)/login/LoginForm.tsx`, so the annotation editor, canvas preview colors, mask label colors, and authenticated workspace theme are not globally redesigned by the login update.

DESIGN-002 reuses that token direction for the authenticated AppShell and project workspace. `src/components/shell/AppShell.tsx`, `src/components/shell/AppSidebar.tsx`, and `src/components/workspace/*` consume the shell/workspace variables directly, keeping raw theme values inside `src/design/**`. The authenticated Projects page mirrors the SaPen Core contextual-sidebar pattern locally because SaPen Annotate does not currently import Core workspace primitives as a package.

DESIGN-005 aligns the authenticated top bar with SaPen Core `AppTopBar` using the same shell height, background, border, and logo-first brand area. The implementation stays token-driven in `src/components/shell/AppTopbar.tsx`; Core-only raw color utilities are not copied because `npm run check:design-hardcoding` treats raw color classes outside `src/design/**` as regressions.

DESIGN-007 refines that topbar alignment by using tokenized Core-style breadcrumb text instead of a local-tab underline treatment. The Projects workspace removes its redundant `WorkspaceTopTabs` row, so the authenticated shell keeps vertical space for project content and editors while retaining local tabs only where they represent real in-page modes.

DESIGN-008 reuses the same token-driven Core-style sidebar row treatment for image-scoped editor navigation. Active image rows use `--workspace-selected` and `--accent-primary` for the selected background and left stripe, while inactive image rows use muted sidebar text tokens without decorative bullet markers. The implementation does not copy Core raw color utilities because `npm run check:design-hardcoding` governs raw colors outside `src/design/**`.
