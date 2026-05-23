# App Router

`src/app` owns route-addressable workflows and API handlers.

Implementation uses route groups to keep public URLs stable while separating public and authenticated route trees:

- `src/app/(public)/login/page.tsx` backs `/login`.
- `src/app/(workspace)/app/layout.tsx` wraps authenticated `/app/**` routes with `src/components/shell/AppShell.tsx`.
- `src/app/(workspace)/app/**/page.tsx` files are thin wrappers around `src/features/**`.
- `src/app/api/**/route.ts` keeps HTTP route handlers colocated with App Router APIs.

Current stable browser routes:

- `/`
- `/login`
- `/app`
- `/app/projects`
- `/app/projects/new`
- `/app/projects/[projectId]`
- `/app/projects/[projectId]/images`
- `/app/projects/[projectId]/images/[imageId]/edit`
- `/app/projects/[projectId]/images/[imageId]/crop`
- `/app/projects/[projectId]/images/[imageId]/crop/bboxes`
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]`

Routes stay URL-first; feature behavior should not be hidden in a single client-only app shell.
