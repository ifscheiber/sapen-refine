# Projects Feature

Projects are the current collaboration container for image annotation.

Important files:

- `src/app/(workspace)/app/projects/page.tsx`
- `src/app/(workspace)/app/projects/new/page.tsx`
- `src/app/(workspace)/app/projects/[projectId]/page.tsx`
- `src/app/(workspace)/app/projects/[projectId]/exports/page.tsx`
- `src/app/(workspace)/app/projects/[projectId]/prediction-imports/page.tsx`
- `src/features/projects/ProjectsWorkspacePage.tsx`
- `src/features/projects/NewProjectPage.tsx`
- `src/features/projects/ProjectOperationsNav.tsx`
- `src/features/projects/ProjectExportsPage.tsx`
- `src/features/projects/ProjectPredictionImportsPage.tsx`
- `src/features/projects/ProjectMetadataForm.tsx`
- `src/features/projects/ProjectExportPanel.tsx`
- `src/features/projects/ProjectPredictionImportBatchPanel.tsx`
- `src/features/projects/ProjectCorrectionTasksPage.tsx`
- `src/features/projects/ProjectCorrectionTaskQueue.tsx`
- `src/app/api/projects/route.ts`
- `src/app/api/projects/[projectId]/route.ts`
- `src/app/api/projects/[projectId]/crop-readiness/route.ts`
- `src/app/api/projects/[projectId]/export/readiness/route.ts`
- `src/app/api/projects/[projectId]/exports/route.ts`
- `src/app/api/projects/[projectId]/prediction-analysis-export/readiness/route.ts`
- `src/app/api/projects/[projectId]/prediction-analysis-exports/route.ts`
- `src/app/api/projects/[projectId]/prediction-runs/route.ts`
- `src/app/api/projects/[projectId]/prediction-import-batches/route.ts`
- `src/app/api/projects/[projectId]/correction-tasks/route.ts`
- `src/app/api/prediction-runs/[predictionRunId]/route.ts`
- `src/app/api/prediction-runs/[predictionRunId]/predictions/route.ts`
- `src/app/api/prediction-runs/[predictionRunId]/batch-imports/route.ts`
- `src/app/api/prediction-import-batches/[batchId]/route.ts`
- `src/app/api/prediction-import-batches/[batchId]/items/route.ts`
- `src/app/api/prediction-import-batches/[batchId]/process/route.ts`
- `src/app/api/prediction-import-batches/process-due/route.ts`
- `src/app/api/prediction-import-batches/[batchId]/retry/route.ts`
- `src/app/api/prediction-runs/[predictionRunId]/correction-tasks/route.ts`
- `src/app/api/correction-tasks/[taskId]/route.ts`
- `src/app/api/exports/[exportId]/route.ts`
- `src/app/api/exports/[exportId]/download/route.ts`
- `src/app/api/prediction-analysis-exports/[exportId]/route.ts`
- `src/app/api/prediction-analysis-exports/[exportId]/download/route.ts`

Route files are thin wrappers around `src/features/projects`.

## Current Desktop Browser Workflow

- `/app/projects` opens the authenticated project workspace and selects the most recently updated visible annotation project.
- `/app/projects/new` creates a project through `POST /api/projects` only for global `ADMIN` users or users that already own at least one project.
- Project creation and project selection live in the authenticated shell sidebar (`src/components/shell/AppSidebar.tsx`), which lists visible annotation projects and links to `/app/projects/[projectId]`.
- `/app/projects/[projectId]` shows the active-project workspace for one project only. The primary tab lists images for that selected project, and `?tab=settings` shows editable name/description for `OWNER` and `QA`.
- Annotator/`LABELER` users see the focused project/image annotation workspace only: no project creation, project settings, tasks, exports, prediction imports, prediction-analysis, or worker/operator actions.
- The workspace right rail shows project status counts and links to the project overview, tasks, exports, and prediction imports through `src/features/projects/ProjectOperationsNav.tsx` only when the user's project role has those capabilities. Image listing/upload lives on the project overview itself.
- `/app/projects/[projectId]/exports` shows the training export panel and the separated prediction-analysis export panel.
- `/app/projects/[projectId]/prediction-imports` shows RB-061 prediction batch import operations for project `OWNER`/`QA`; Annotator/`LABELER` users do not see or access this route.
- `/app/projects/[projectId]/tasks` shows the RB-058 active-learning correction task queue for project `OWNER`/`QA`; Annotator/`LABELER` users do not see or access this route.
- Task rows link to `/app/projects/[projectId]/tasks/[taskId]/correct` for RB-059 assisted correction.
- The training export panel shows approved semantic/support/classification readiness counts, crop readiness/reason counts from the shared crop resolver, target selection, and owner-only export creation with manifest/package download links.
- The prediction-analysis export panel shows proposal counts, metric-ready counts, candidates missing approved references, prediction-run selection, target selection, optional human-reference inclusion, and owner/QA export creation. It labels prediction-analysis packages and QA metrics as model-evaluation metadata, not ground-truth training labels.
- The prediction batch import panel lets owner/QA users select a prediction run, upload a ZIP manifest package, inspect status/counts/item errors, and trigger process/retry passes. It does not expose private staging keys.
- Project membership remains the authorization boundary for image and editor routes.

## Current Ownership And Access

- `POST /api/projects` creates an `AnnotationProject` and owner `AnnotationProjectMember` only for global `ADMIN` users or users that already own at least one project.
- `PATCH /api/projects/[projectId]` updates project name/description for `OWNER` and `QA` and attaches the default active label schema when a project is missing one.
- `AnnotationProjectRole.OWNER`, `QA`, `LABELER`, and `VIEWER` exist in `prisma/schema.prisma`.
- `src/server/auth/rbac.ts` checks project membership for project/image/editor access.
- Current editable image and mask routes allow `OWNER`, `QA`, and `LABELER`; `VIEWER` can read project/image data where route handlers permit it.
- `GET /api/projects/[projectId]/export/readiness` is available to project `OWNER`/`QA`; Annotator/`LABELER` users receive `403 FORBIDDEN`.
- `GET /api/projects/[projectId]/crop-readiness` is available to authenticated project members and returns sanitized per-crop readiness, optional image/slice filtering, and review action availability.
- `POST /api/projects/[projectId]/exports` and export downloads are restricted to `OWNER` in RB-053.
- `GET /api/projects/[projectId]/prediction-analysis-export/readiness` is available to project `OWNER`/`QA`; Annotator/`LABELER` users receive `403 FORBIDDEN`.
- `POST /api/projects/[projectId]/prediction-analysis-exports` and `/api/prediction-analysis-exports/[exportId]/download` are restricted to project `OWNER` and `QA`.
- `GET /api/projects/[projectId]/prediction-runs` and `GET /api/prediction-runs/[predictionRunId]` are available to project `OWNER`/`QA`.
- `POST /api/projects/[projectId]/prediction-runs` is restricted to `OWNER` and `QA`; it creates provenance records only and does not import prediction files.
- `POST /api/prediction-runs/[predictionRunId]/predictions` is restricted to project `OWNER` and `QA`; it imports one prediction mask proposal and does not create correction tasks.
- RB-061 prediction batch import create/list/detail/items/process/retry APIs are restricted to project `OWNER` and `QA`; they process `SEMANTIC_MASK` and `SLICE_SUPPORT_MASK` prediction masks through the RB-057 import service and do not create correction tasks automatically.
- `POST /api/prediction-runs/[predictionRunId]/correction-tasks` is restricted to project `OWNER` and `QA`; it creates idempotent correction tasks from prediction provenance rows.
- Correction-task listing/detail, assisted correction context/read/save, and task updates are restricted to project `OWNER`/`QA`. Annotator/`LABELER` users use direct image/crop annotation workflows instead.
- `POST /api/storage-cleanup` is global-admin only and not project-role based; project or batch filters only narrow cleanup scope.

## MVP Limitations

- Projects now carry an optional active label schema version and surface missing schema setup in the UI.
- RB-053 adds basic owner-only training export from `/app/projects/[projectId]/exports`. RB-060 adds separate owner/QA prediction-analysis exports from the same route. Advanced export filters, export history UI, and advanced reviewer administration remain deferred.
- RB-056 adds project-scoped prediction-run provenance APIs, RB-057 adds the server-side prediction mask import API, RB-058 adds the first project correction task queue, RB-059 adds the first assisted correction editor, RB-060 adds the separate prediction-analysis export, RB-061 adds ZIP batch prediction import controls, RB-065 adds optional due-batch worker processing for owner/QA users, RB-066 adds admin-only storage cleanup without adding project UI, and RB-067 adds export-time QA metrics without adding a dashboard.
- RB-063 moves heavy export and prediction-import controls out of the overview into dedicated project operations routes.
- Project creation is sufficient for the desktop smoke path and maps to the annotation-domain schema baseline.
- Projects do not yet model reviewer/export permissions separately from the broad `QA` role.
- Projects are standalone annotation projects and must not be treated as SaPen Core experiments without a future explicit handoff contract.
