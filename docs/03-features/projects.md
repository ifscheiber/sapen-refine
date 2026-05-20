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
- `src/features/projects/ProjectExportPanel.tsx`
- `src/features/projects/ProjectCorrectionTasksPage.tsx`
- `src/features/projects/ProjectCorrectionTaskQueue.tsx`
- `src/app/api/projects/route.ts`
- `src/app/api/projects/[projectId]/route.ts`
- `src/app/api/projects/[projectId]/export/readiness/route.ts`
- `src/app/api/projects/[projectId]/exports/route.ts`
- `src/app/api/projects/[projectId]/prediction-runs/route.ts`
- `src/app/api/projects/[projectId]/correction-tasks/route.ts`
- `src/app/api/prediction-runs/[predictionRunId]/route.ts`
- `src/app/api/prediction-runs/[predictionRunId]/predictions/route.ts`
- `src/app/api/prediction-runs/[predictionRunId]/correction-tasks/route.ts`
- `src/app/api/correction-tasks/[taskId]/route.ts`
- `src/app/api/exports/[exportId]/route.ts`
- `src/app/api/exports/[exportId]/download/route.ts`

Route files are thin wrappers around `src/features/projects`.

## Current Desktop Browser Workflow

- `/app/projects` lists projects where the authenticated user has membership.
- `/app/projects/new` creates a project through `POST /api/projects`.
- `/app/projects/[projectId]` shows the project overview, editable name/description for `OWNER` and `QA`, active label schema state, membership role, timestamps, links to images and correction tasks, and the training export panel.
- `/app/projects/[projectId]/tasks` shows the RB-058 active-learning correction task queue with prediction-run task creation, active/mine/all views, claim/start/dismiss controls, owner/QA priority controls, and editor links prepared for RB-059.
- Task rows link to `/app/projects/[projectId]/tasks/[taskId]/correct` for RB-059 assisted correction.
- The training export panel shows approved semantic/support/classification readiness counts, target selection, and owner-only export creation with manifest/package download links.
- Project membership remains the authorization boundary for image and editor routes.

## Current Ownership And Access

- `POST /api/projects` creates an `AnnotationProject` and owner `AnnotationProjectMember` for the authenticated user.
- `PATCH /api/projects/[projectId]` updates project name/description for `OWNER` and `QA` and attaches the default active label schema when a project is missing one.
- `AnnotationProjectRole.OWNER`, `QA`, `LABELER`, and `VIEWER` exist in `prisma/schema.prisma`.
- `src/server/auth/rbac.ts` checks project membership for project/image/editor access.
- Current editable image and mask routes allow `OWNER`, `QA`, and `LABELER`; `VIEWER` can read project/image data where route handlers permit it.
- `GET /api/projects/[projectId]/export/readiness` is available to authenticated project members.
- `POST /api/projects/[projectId]/exports` and export downloads are restricted to `OWNER` in RB-053.
- `GET /api/projects/[projectId]/prediction-runs` is available to project members.
- `POST /api/projects/[projectId]/prediction-runs` is restricted to `OWNER` and `QA`; it creates provenance records only and does not import prediction files.
- `POST /api/prediction-runs/[predictionRunId]/predictions` is restricted to project `OWNER` and `QA`; it imports one prediction mask proposal and does not create correction tasks.
- `POST /api/prediction-runs/[predictionRunId]/correction-tasks` is restricted to project `OWNER` and `QA`; it creates idempotent correction tasks from prediction provenance rows.
- Correction-task listing/detail is available to project members. `OWNER`/`QA` can manage assignment and priority; `LABELER` can claim/start/dismiss eligible active tasks; `VIEWER` is read-only.
- Assisted correction context/read/save is available to `OWNER`, `QA`, and eligible `LABELER` users; `VIEWER` remains read-only and cannot open the mutation editor.

## MVP Limitations

- Projects now carry an optional active label schema version and surface missing schema setup in the UI.
- RB-053 adds basic owner-only training export from the project overview. Advanced export filters, export history UI, QA export policy, and advanced reviewer administration remain deferred.
- RB-056 adds project-scoped prediction-run provenance APIs, RB-057 adds the server-side prediction mask import API, RB-058 adds the first project correction task queue, and RB-059 adds the first assisted correction editor. Prediction import controls remain deferred.
- Project creation is sufficient for the desktop smoke path and maps to the annotation-domain schema baseline.
- Projects do not yet model reviewer/export permissions separately from the broad `QA` role.
- Projects are standalone annotation projects and must not be treated as SaPen Core experiments without a future explicit handoff contract.
