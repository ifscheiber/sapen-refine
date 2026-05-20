# App Routes

## Purpose

This page lists current browser routes backed by `src/app`.

## Current Routes

- `/` - redirects to `/app` or `/login?next=/app` from `src/app/page.tsx`.
- `/login` - login form from `src/app/(public)/login/page.tsx`.
- `/app` - redirects to `/app/projects` from `src/app/(workspace)/app/page.tsx`.
- `/app/projects` - authenticated project list from `src/app/(workspace)/app/projects/page.tsx` and `src/features/projects/ProjectsIndex.tsx`.
- `/app/projects/new` - project creation page from `src/app/(workspace)/app/projects/new/page.tsx` and `src/features/projects/NewProjectPage.tsx`.
- `/app/projects/[projectId]` - project landing page from `src/app/(workspace)/app/projects/[projectId]/page.tsx` and `src/features/projects/ProjectOverview.tsx`.
- `/app/projects/[projectId]/tasks` - project active-learning correction task queue from `src/app/(workspace)/app/projects/[projectId]/tasks/page.tsx` and `src/features/projects/ProjectCorrectionTasksPage.tsx`.
- `/app/projects/[projectId]/tasks/[taskId]/correct` - assisted correction editor for prediction-backed tasks from `src/app/(workspace)/app/projects/[projectId]/tasks/[taskId]/correct/page.tsx` and `src/features/editor/CorrectionTaskEditorPage.tsx`.
- `/app/projects/[projectId]/images` - project image list/upload page from `src/app/(workspace)/app/projects/[projectId]/images/page.tsx` and `src/features/images/ProjectImagesPage.tsx`.
- `/app/projects/[projectId]/images/[imageId]` - image metadata page from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/page.tsx` and `src/features/images/ImageMetadataPage.tsx`.
- `/app/projects/[projectId]/images/[imageId]/edit` - image editor from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx` and `src/features/editor/EditImagePage.tsx`.

## Invariants And Constraints

- Protected project routes must verify session and membership server-side.
- Future tablet/iPad layouts should preserve the same URL routes unless a ticket explicitly changes navigation.
- Task queue links to the assisted correction route for prediction-backed correction tasks.

## Known Gaps

- Export UI is implemented as a project overview panel; there is no separate export history/dashboard browser route.
- Review/approval is implemented as API/editor controls, not as a separate reviewer dashboard route.

## Related Tickets / Docs

- [README.md](README.md)
- [../../workflows/annotation-from-scratch.md](../../workflows/annotation-from-scratch.md)
