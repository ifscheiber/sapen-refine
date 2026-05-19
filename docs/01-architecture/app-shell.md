# App Shell

Implemented shell components:

- `src/components/shell/AppShell.tsx` - authenticated workspace frame.
- `src/components/shell/AppSidebar.tsx` - desktop primary navigation.
- `src/components/shell/AppTopbar.tsx` - user/session context and logout action.
- `src/components/shell/AppPageHeader.tsx` - page title/description/action pattern.
- `src/components/shell/AppMain.tsx` - responsive content container.
- `src/components/shell/AppEmptyState.tsx` - reusable empty state.
- `src/components/shell/AppSection.tsx` - reusable bordered surface.

`src/app/(workspace)/app/layout.tsx` authenticates the user and composes the shell. The shell does not own annotation-domain business logic.
