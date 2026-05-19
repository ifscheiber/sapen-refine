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

## Current Ownership And Access

- `POST /api/projects` creates a `Project` and an owner `ProjectMember` for the authenticated user.
- `ProjectRole.OWNER`, `QA`, `LABELER`, and `VIEWER` exist in `prisma/schema.prisma`.
- `src/server/auth/rbac.ts` checks project membership for project/image/editor access.
- Current editable image and mask routes allow `OWNER`, `QA`, and `LABELER`; `VIEWER` can read project/image data where route handlers permit it.

## MVP Limitations

- Projects do not yet include final trial/customer metadata, dataset export settings, or review workflow state.
- Project creation is sufficient for the desktop smoke path but not the final annotation-domain model.
- Projects do not yet select a label schema version.
- Projects do not yet model reviewer/export permissions separately from the broad `QA` role.
- Projects are standalone annotation projects and must not be treated as SaPen Core experiments without a future explicit handoff contract.
