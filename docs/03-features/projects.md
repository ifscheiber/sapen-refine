# Projects Feature

Projects are the current collaboration container for image annotation.

Important files:

- `src/app/(workspace)/app/projects/page.tsx`
- `src/app/(workspace)/app/projects/new/page.tsx`
- `src/app/(workspace)/app/projects/[projectId]/page.tsx`
- `src/features/projects/ProjectsIndex.tsx`
- `src/features/projects/NewProjectPage.tsx`
- `src/features/projects/ProjectOverview.tsx`
- `src/app/api/projects/route.ts`

Route files are thin wrappers around `src/features/projects`.

## Current Desktop Browser Workflow

- `/app/projects` lists projects where the authenticated user has membership.
- `/app/projects/new` creates a project through `POST /api/projects`.
- `/app/projects/[projectId]` shows the current project overview and links to images.
- Project membership remains the authorization boundary for image and editor routes.

## MVP Limitations

- Projects do not yet include final trial/customer metadata, dataset export settings, or review workflow state.
- Project creation is sufficient for the desktop smoke path but not the final annotation-domain model.
