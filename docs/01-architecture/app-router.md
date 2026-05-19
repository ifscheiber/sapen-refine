# App Router

`src/app` owns route-addressable workflows and API handlers.

Current stable browser routes:

- `/`
- `/login`
- `/app`
- `/app/projects`
- `/app/projects/new`
- `/app/projects/[projectId]`
- `/app/projects/[projectId]/images`
- `/app/projects/[projectId]/images/[imageId]/edit`

RB-043 target: keep URLs stable while organizing implementation files with route groups and thin route composition files.
