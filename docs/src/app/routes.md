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
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]` - compatibility selected-slice route from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/page.tsx` and `src/features/editor/ImageCropSlicesPage.tsx`; it redirects to the selected crop workbench when a current crop exists, otherwise it can still show the full navigator fallback.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]` - selected crop workbench from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/page.tsx` and `src/features/editor/CropWorkbenchPage.tsx`; it shows crop preview, mode-aware guidance, status/readiness, and the embedded slice navigator.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/support` - crop workflow support-mask editor alias from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/support/page.tsx` and `src/features/editor/CropSupportEditorPage.tsx`.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic` - crop workflow semantic-mask editor alias from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic/page.tsx` and `src/features/editor/CropSemanticEditorPage.tsx`; `mode=SAP_HEARTWOOD` or `mode=COPPER` can preselect the semantic family. Opposite-family editing is guarded in the editor/API and requires explicit reset before save.
- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support` - compatibility crop support-mask editor from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support/page.tsx`.
- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic` - compatibility crop semantic-mask editor from `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic/page.tsx`.
- Unknown workspace routes are caught by `src/app/(workspace)/app/[...missing]/page.tsx` and render the SaPen Annotate workspace not-found fallback from `src/app/(workspace)/app/not-found.tsx`; unknown non-workspace routes render `src/app/not-found.tsx`.

## Planned Crop Workflow Routes

RB-094 implements the crop workflow entry and BBox stage. RB-095 implements the slice navigator. RB-096 implements the selected crop workbench and crop-prefixed support/semantic tool routes.

The existing `/edit` route remains a current compatibility route until RB-104 removes the legacy full-image editor surface. The existing crop support and semantic routes remain current deep-link editor routes while the guided crop workbench route family is completed.

Post-hotfix ticket updates:

- RB-103 implements explicit crop-editor navigation back to `/app/projects/[projectId]/images/[imageId]/crop/bboxes` so users can revise a confirmed BBox set after crop inspection. Re-entry alone keeps the set confirmed; mutation requires an explicit `Edit BBoxes` unlock and later re-confirmation.
- RB-104 plans to remove `/app/projects/[projectId]/images/[imageId]/edit` as a user-facing product route and remove visible `Open editor` / `Full editor` links.

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
