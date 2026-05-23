# Routes

See `docs/src/app/routes.md` for the current route list.

RB-043 kept public URLs stable while moving implementation files into route groups:

- public route group: `src/app/(public)`
- workspace route group: `src/app/(workspace)`

RB-058 adds the project correction task queue route at `/app/projects/[projectId]/tasks`.
RB-059 adds the assisted correction editor route at `/app/projects/[projectId]/tasks/[taskId]/correct`.
RB-094 adds the crop workflow entry and BBox stage routes under `/app/projects/[projectId]/images/[imageId]/crop`.
RB-095 adds the whole-image slice navigator at `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]`.
