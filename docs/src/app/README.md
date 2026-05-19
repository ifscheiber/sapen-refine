# src/app

## Purpose

`src/app` owns route-addressable workflows and API route handlers for the Next.js App Router application.

## Important Files

- `src/app/layout.tsx` - root metadata, fonts, global styles, and document shell.
- `src/app/page.tsx` - redirects authenticated users to `/app` and unauthenticated users to `/login?next=/app`.
- `src/app/login/page.tsx` - client login form posting to `/api/auth/login`.
- `src/app/app/layout.tsx` - protected application layout.
- `src/app/app/AppShell.tsx` - current MVP project/image/editor shell.
- `src/app/app/projects/**` - route-addressable project, image, and editor pages.
- `src/app/api/**/route.ts` - HTTP API route handlers.

## Public Interfaces / Routes / Functions

See [routes.md](routes.md) and [api.md](api.md).

## Invariants And Constraints

- Workflows should stay URL-addressable.
- Pages should call server-side auth/RBAC helpers for protected routes.
- API route handlers should persist domain state through server/database modules rather than client-only state.

## Known Gaps

- `src/app/app/AppShell.tsx` still contains MVP client-heavy workflow state.
- Build currently fails on a pre-existing TypeScript issue in `src/app/app/AppShell.tsx`.
- Some route handlers need stronger validation before production training-data use.

## Related Tickets / Docs

- [../../known-gaps.md](../../known-gaps.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
