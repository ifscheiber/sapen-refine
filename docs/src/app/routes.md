# App Routes

## Purpose

This page lists current browser routes backed by `src/app`.

## Current Routes

- `/` - redirects to `/app` or `/login?next=/app` from `src/app/page.tsx`.
- `/login` - login form from `src/app/(public)/login/page.tsx`.
- `/app` - redirects to `/app/projects` from `src/app/(workspace)/app/page.tsx`.
- `/app/projects` - authenticated active-project workspace from `src/app/(workspace)/app/projects/page.tsx` and `src/features/projects/ProjectsWorkspacePage.tsx`; it selects the most recently updated visible project.
- `/app/projects/new` - project creation page from `src/app/(workspace)/app/projects/new/page.tsx` and `src/features/projects/NewProjectPage.tsx`; visible/useful only to global `ADMIN` users or users that already own a project.
- `/app/projects/[projectId]` - active-project image workspace from `src/app/(workspace)/app/projects/[projectId]/page.tsx` and `src/features/projects/ProjectsWorkspacePage.tsx`, including project context, image list/upload controls, status rail, and capability-filtered project operations links. `?tab=settings` opens the project metadata settings tab for `OWNER`/`QA`.
- `/app/projects/[projectId]/exports` - project export operations from `src/app/(workspace)/app/projects/[projectId]/exports/page.tsx` and `src/features/projects/ProjectExportsPage.tsx`, including training export and prediction-analysis export panels for `OWNER`/`QA`.
- `/app/projects/[projectId]/prediction-imports` - project prediction import operations from `src/app/(workspace)/app/projects/[projectId]/prediction-imports/page.tsx` and `src/features/projects/ProjectPredictionImportsPage.tsx`, including RB-061 batch import controls for owner/QA. RB-065 adds optional API worker processing without changing this browser route; RB-066 storage cleanup is API/CLI-only and has no browser route.
- `/app/projects/[projectId]/tasks` - project active-learning correction task queue from `src/app/(workspace)/app/projects/[projectId]/tasks/page.tsx` and `src/features/projects/ProjectCorrectionTasksPage.tsx` for `OWNER`/`QA`.
- `/app/projects/[projectId]/tasks/[taskId]/correct` - assisted correction editor for prediction-backed tasks from `src/app/(workspace)/app/projects/[projectId]/tasks/[taskId]/correct/page.tsx` and `src/features/editor/CorrectionTaskEditorPage.tsx` for `OWNER`/`QA`.
- `/app/projects/[projectId]/images` - compatibility redirect from `src/app/(workspace)/app/projects/[projectId]/images/page.tsx` to `/app/projects/[projectId]`; the project root is the canonical image list/upload workspace.
- `/app/projects/[projectId]/images/[imageId]` - image metadata page from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/page.tsx` and `src/features/images/ImageMetadataPage.tsx`.
- `/app/projects/[projectId]/images/[imageId]/crop` - crop workflow entry route from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/page.tsx` and `src/features/editor/ImageCropWorkflowEntryPage.tsx`; it redirects to the BBox stage or slice navigator based on persisted BBox workflow state.
- `/app/projects/[projectId]/images/[imageId]/crop/bboxes` - image-level BBox stage from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/bboxes/page.tsx` and `src/features/editor/ImageCropBBoxesPage.tsx`.
- `/app/projects/[projectId]/images/[imageId]/crop/slices` - compatibility slice navigator entry from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/slices/page.tsx` and `src/features/editor/ImageCropSlicesPage.tsx`; it requires a confirmed BBox set and redirects toward the selected crop editor when a current crop exists.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]` - compatibility selected-slice route from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/page.tsx` and `src/features/editor/ImageCropSlicesPage.tsx`; it redirects to the selected crop editor when a current crop exists, otherwise it can still show the full navigator fallback.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]` - canonical unified crop annotation editor from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/page.tsx` and `src/features/editor/CropSemanticEditorPage.tsx`; it shows the crop canvas, annotation-family selector, status/readiness, classification/review controls, and embedded slice navigator.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/support` - compatibility alias from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/support/page.tsx`; it redirects to the unified editor with `target=support`.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic` - compatibility alias from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic/page.tsx`; it redirects to the unified editor with `target=semantic` and optional `mode=SAP_HEARTWOOD` or `mode=COPPER`.
- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support` - non-crop-prefixed compatibility alias that redirects to the canonical unified editor with support selected.
- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic` - non-crop-prefixed compatibility alias that redirects to the canonical unified editor with semantic selected.
- Unknown workspace routes are caught by `src/app/(workspace)/app/[...missing]/page.tsx` and render the SaPen Annotate workspace not-found fallback from `src/app/(workspace)/app/not-found.tsx`; unknown non-workspace routes render `src/app/not-found.tsx`.

## Crop Workflow Route Notes

RB-094 implements the crop workflow entry and BBox stage. RB-095 implements the slice navigator. RB-096 implemented the earlier selected-crop workbench. RB-123 makes `/crops/[cropId]` the unified crop annotation editor and keeps the old support/semantic routes as redirects.

RB-104 removes the legacy `/app/projects/[projectId]/images/[imageId]/edit` product route. Unknown old editor links now use normal workspace not-found behavior. Image list and metadata pages route annotation work to `/crop`.

Post-hotfix ticket updates:

- RB-103 implements explicit crop-editor navigation back to `/app/projects/[projectId]/images/[imageId]/crop/bboxes` so users can revise a confirmed BBox set after crop inspection. Re-entry alone keeps the set confirmed; mutation requires an explicit `Edit BBoxes` unlock and later re-confirmation.
- RB-104 removed visible `Open editor` / `Full editor` links and keeps BBox-stage plus assisted-correction editor surfaces as the only shared full-image canvas users.

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
