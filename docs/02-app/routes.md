# Routes

See `docs/src/app/routes.md` for the current route list.

RB-043 kept public URLs stable while moving implementation files into route groups:

- public route group: `src/app/(public)`
- workspace route group: `src/app/(workspace)`

RB-058 adds the project correction task queue route at `/app/projects/[projectId]/tasks`.
