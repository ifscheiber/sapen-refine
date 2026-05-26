# App Shell

Implemented shell components:

- `src/components/shell/AppShell.tsx` - authenticated workspace frame.
- `src/components/shell/AppSidebar.tsx` - desktop primary navigation.
- `src/components/shell/AppTopbar.tsx` - Core-aligned SaPen logo top bar, breadcrumb navigation, user context icon, and logout action.
- `src/components/shell/AppShellContext.tsx` and `src/components/shell/editorShellContext.ts` - route-aware shell context for image-scoped editor breadcrumbs/sidebar state.
- `src/components/shell/AppPageHeader.tsx` - page title/description/action pattern.
- `src/components/shell/AppMain.tsx` - responsive content container.
- `src/components/shell/AppEmptyState.tsx` - reusable empty state.
- `src/components/shell/AppSection.tsx` - reusable bordered surface.

`src/app/(workspace)/app/layout.tsx` authenticates the user and composes the shell. The shell does not own annotation-domain business logic.

DESIGN-005 mirrors the SaPen Core `AppTopBar` locally instead of importing it at runtime. SaPen Annotate does not currently depend on the shared `@sapen/ui` and `@sapen/assets` packages, so the authenticated top bar uses the Core layout shape and copied SaPen logo asset while preserving local route and logout behavior.

DESIGN-007 replaces the underlined Projects topbar item with a quieter Core-style breadcrumb treatment, fixes the rendered logo box to the Core `132x30` size, and removes the redundant Projects workspace top-tab row. Local workspace/editor tabs remain available for true in-page modes.

DESIGN-008 keeps project pages project-scoped but switches annotation editor routes under `/app/projects/[projectId]/images/[imageId]/crop...` and the compatibility `/images/[imageId]/slices...` aliases to image-scoped shell context. On those routes the topbar breadcrumbs show `Projects / project / image`, and the left sidebar shows `IMAGE SUMMARY`, a project-images list without decorative bullet markers, and only image-relevant navigation. The image list uses the existing read-only project images API plus `sliceCount`; true per-user last-opened ordering remains deferred, so the active image is pinned first and the rest sort by image update/create time.
