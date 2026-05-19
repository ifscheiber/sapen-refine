# Projects Feature

Projects are the current collaboration container for image annotation.

Important files:

- `src/app/(workspace)/app/projects/page.tsx`
- `src/app/(workspace)/app/projects/new/page.tsx`
- `src/app/(workspace)/app/projects/[projectId]/page.tsx`
- `src/features/projects/ProjectsIndex.tsx`
- `src/features/projects/NewProjectPage.tsx`
- `src/features/projects/ProjectOverview.tsx`
- `src/features/projects/ProjectMetadataForm.tsx`
- `src/app/api/projects/route.ts`
- `src/app/api/projects/[projectId]/route.ts`

Route files are thin wrappers around `src/features/projects`.

## Current Desktop Browser Workflow

- `/app/projects` lists projects where the authenticated user has membership.
- `/app/projects/new` creates a project through `POST /api/projects`.
- `/app/projects/[projectId]` shows the project overview, editable name/description for `OWNER` and `QA`, active label schema state, membership role, timestamps, and a link to images.
- Project membership remains the authorization boundary for image and editor routes.

## Current Ownership And Access

- `POST /api/projects` creates an `AnnotationProject` and owner `AnnotationProjectMember` for the authenticated user.
- `PATCH /api/projects/[projectId]` updates project name/description for `OWNER` and `QA` and attaches the default active label schema when a project is missing one.
- `AnnotationProjectRole.OWNER`, `QA`, `LABELER`, and `VIEWER` exist in `prisma/schema.prisma`.
- `src/server/auth/rbac.ts` checks project membership for project/image/editor access.
- Current editable image and mask routes allow `OWNER`, `QA`, and `LABELER`; `VIEWER` can read project/image data where route handlers permit it.

## MVP Limitations

- Projects now carry an optional active label schema version and surface missing schema setup in the UI; dataset export settings and review workflow UI remain deferred.
- Project creation is sufficient for the desktop smoke path and maps to the annotation-domain schema baseline.
- Projects do not yet model reviewer/export permissions separately from the broad `QA` role.
- Projects are standalone annotation projects and must not be treated as SaPen Core experiments without a future explicit handoff contract.
