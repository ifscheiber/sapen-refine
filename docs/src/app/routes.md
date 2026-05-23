# App Routes

## Purpose

This page lists current browser routes backed by `src/app`.

## Current Routes

- `/` - redirects to `/app` or `/login?next=/app` from `src/app/page.tsx`.
- `/login` - login form from `src/app/(public)/login/page.tsx`.
- `/app` - redirects to `/app/projects` from `src/app/(workspace)/app/page.tsx`.
- `/app/projects` - authenticated project list from `src/app/(workspace)/app/projects/page.tsx` and `src/features/projects/ProjectsIndex.tsx`.
- `/app/projects/new` - project creation page from `src/app/(workspace)/app/projects/new/page.tsx` and `src/features/projects/NewProjectPage.tsx`.
- `/app/projects/[projectId]` - project status/action hub from `src/app/(workspace)/app/projects/[projectId]/page.tsx` and `src/features/projects/ProjectOverview.tsx`, including metadata, readiness summaries, and project operations links.
- `/app/projects/[projectId]/exports` - project export operations from `src/app/(workspace)/app/projects/[projectId]/exports/page.tsx` and `src/features/projects/ProjectExportsPage.tsx`, including training export and prediction-analysis export panels.
- `/app/projects/[projectId]/prediction-imports` - project prediction import operations from `src/app/(workspace)/app/projects/[projectId]/prediction-imports/page.tsx` and `src/features/projects/ProjectPredictionImportsPage.tsx`, including RB-061 batch import controls for owner/QA. RB-065 adds optional API worker processing without changing this browser route; RB-066 storage cleanup is API/CLI-only and has no browser route.
- `/app/projects/[projectId]/tasks` - project active-learning correction task queue from `src/app/(workspace)/app/projects/[projectId]/tasks/page.tsx` and `src/features/projects/ProjectCorrectionTasksPage.tsx`.
- `/app/projects/[projectId]/tasks/[taskId]/correct` - assisted correction editor for prediction-backed tasks from `src/app/(workspace)/app/projects/[projectId]/tasks/[taskId]/correct/page.tsx` and `src/features/editor/CorrectionTaskEditorPage.tsx`.
- `/app/projects/[projectId]/images` - project image list/upload page from `src/app/(workspace)/app/projects/[projectId]/images/page.tsx` and `src/features/images/ProjectImagesPage.tsx`.
- `/app/projects/[projectId]/images/[imageId]` - image metadata page from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/page.tsx` and `src/features/images/ImageMetadataPage.tsx`.
- `/app/projects/[projectId]/images/[imageId]/edit` - image editor from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx` and `src/features/editor/EditImagePage.tsx`.
- `/app/projects/[projectId]/images/[imageId]/crop` - crop workflow entry route from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/page.tsx` and `src/features/editor/ImageCropWorkflowEntryPage.tsx`; it redirects to the BBox stage or slice navigator based on persisted BBox workflow state.
- `/app/projects/[projectId]/images/[imageId]/crop/bboxes` - image-level BBox stage from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/bboxes/page.tsx` and `src/features/editor/ImageCropBBoxesPage.tsx`.
- `/app/projects/[projectId]/images/[imageId]/crop/slices` - compatibility slice navigator entry from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/slices/page.tsx` and `src/features/editor/ImageCropSlicesPage.tsx`; it requires a confirmed BBox set and redirects toward the selected crop editor when a current crop exists.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]` - compatibility selected-slice route from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/page.tsx` and `src/features/editor/ImageCropSlicesPage.tsx`; it redirects to the selected slice semantic editor when the current crop exists, otherwise it can still show the full navigator fallback.
- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support` - crop support-mask editor from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support/page.tsx` and `src/features/editor/CropSupportEditorPage.tsx`; it embeds the slice navigator as a right rail.
- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic` - crop semantic-mask editor from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic/page.tsx` and `src/features/editor/CropSemanticEditorPage.tsx`; RB-090 also shows the latest slice classification suggestion and manual override controls for editable roles, and RB-101 embeds the slice navigator as a right rail.
- Unknown workspace routes are caught by `src/app/(workspace)/app/[...missing]/page.tsx` and render the SaPen Annotate workspace not-found fallback from `src/app/(workspace)/app/not-found.tsx`; unknown non-workspace routes render `src/app/not-found.tsx`.

## Planned Crop Workflow Routes

RB-094 implements the crop workflow entry and BBox stage. RB-095 implements the slice navigator. Later tickets complete the guided crop workbench route family:

- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]` - planned selected crop workbench.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/support` - planned support tool route.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic` - planned semantic tool route.

The existing `/edit`, `/slices/[sliceInstanceId]/crops/[cropId]/support`, and `/slices/[sliceInstanceId]/crops/[cropId]/semantic` routes remain current compatibility routes until RB-096 through RB-098 implement or redirect the guided crop workbench.

## Invariants And Constraints

- Protected project routes must verify session and membership server-side.
- Missing or unauthorized project routes must not leak existence details; known-project stale child resources may render project-aware soft landings.
- Future tablet/iPad layouts should preserve the same URL routes unless a ticket explicitly changes navigation.
- Task queue links to the assisted correction route for prediction-backed correction tasks.
- Crop workflow stages should be URL-addressable and backed by persisted server state, not hidden client-only state.

## Known Gaps

- Export history is still limited to the latest created export result shown in the export panel; there is no full export history dashboard browser route.
- Review/approval is implemented as API/editor controls, not as a separate reviewer dashboard route.

## Related Tickets / Docs

- [README.md](README.md)
- [../../workflows/annotation-from-scratch.md](../../workflows/annotation-from-scratch.md)
