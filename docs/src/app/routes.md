# App Routes

## Purpose

This page lists current browser routes backed by `src/app`.

## Current Routes

- `/` - redirects to `/app` or `/login?next=/app` from `src/app/page.tsx`.
- `/login` - login form from `src/app/login/page.tsx`.
- `/app` - MVP application shell from `src/app/app/page.tsx` and `src/app/app/AppShell.tsx`.
- `/app/projects` - authenticated project list from `src/app/app/projects/page.tsx`.
- `/app/projects/new` - project creation page from `src/app/app/projects/new/page.tsx`.
- `/app/projects/[projectId]` - project landing page from `src/app/app/projects/[projectId]/page.tsx`.
- `/app/projects/[projectId]/images` - project image list/upload page from `src/app/app/projects/[projectId]/images/page.tsx`.
- `/app/projects/[projectId]/images/[imageId]/edit` - image editor from `src/app/app/projects/[projectId]/images/[imageId]/edit/page.tsx`.

## Invariants And Constraints

- Protected project routes must verify session and membership server-side.
- Future tablet/iPad layouts should preserve the same URL routes unless a ticket explicitly changes navigation.

## Known Gaps

- The `/app` shell and project pages overlap in responsibility and need future consolidation.
- Editor routes are present, but review/approval/export routes are not implemented.

## Related Tickets / Docs

- [README.md](README.md)
- [../../workflows/annotation-from-scratch.md](../../workflows/annotation-from-scratch.md)
