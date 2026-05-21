# Manual Smoke - Desktop Browser MVP

## Purpose

This checklist verifies the current desktop browser MVP workflow after the RB-069 trial-readiness slice. It targets the local or trial-deployed browser app and does not require iPad Safari.

## Preconditions

- Local stack is rebuilt or bootstrapped with `npm run db:rebuild` or equivalent trial deployment commands.
- App is running through `npm run dev`, `npm run start`, or the RB-046 trial Compose deployment.
- A named tester account or local seeded admin account exists.
- A small representative PNG or JPEG image fixture is available for upload.

## Desktop Workflow

| Step | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Open `/login`. | Login page renders without console errors. |  |  |
| Log in as a named tester or local seeded admin. | Browser lands in `/app` or the requested `next` route. |  |  |
| Open `/app/projects`. | Project list renders and session persists after reload. |  |  |
| Create a new project. | App redirects to the project detail route. |  |  |
| Open project image list. | Image list renders and upload control is visible for editable roles. |  |  |
| Upload a normal PNG/JPEG image. | Image uploads through the app and appears in the list. |  |  |
| Try an unsupported image type if practical. | Upload fails with `UNSUPPORTED_CONTENT_TYPE` and no private storage URL is exposed. |  |  |
| Open image metadata. | Technical metadata includes content type, size, checksum, dimensions, validation status, T-number state, and readiness summary without exposing private storage URLs. |  |  |
| Enter T-number and basic acquisition metadata. | Metadata saves successfully. |  |  |
| Reload image metadata. | T-number and acquisition fields persist. |  |  |
| Open editor. | Image, canvas stack, tools, labels, zoom, and save controls render. |  |  |
| Draw with Brush. | Overlay changes and dirty state becomes visible. |  |  |
| Select Eraser and erase part of the semantic mask. | Eraser uses the brush size, writes background, and dirty state remains visible. |  |  |
| Click `Save now`. | Semantic mask save completes, dirty state clears, and a draft artifact version exists. |  |  |
| Switch to `Slice support`. | Support mode loads separately from semantic mask mode. |  |  |
| Draw a support mask and save. | Support-mask status shows a draft version after save. |  |  |
| Select Eraser in support mode and erase part of the support mask. | Eraser writes support background rather than a semantic label. |  |  |
| Set slice classification. | Classification persists and is visible after save. |  |  |
| Submit semantic mask, support mask, and slice classification. | Each latest version moves from draft to submitted. |  |  |
| Approve semantic mask, support mask, and slice classification as `OWNER`/`QA`. | Each reviewable unit shows an approved version and export-ready becomes yes. |  |  |
| Reload editor. | Latest saved mask reloads without runtime errors. |  |  |
| Confirm semantic/support/review distinction. | Semantic latest mask, support latest mask, slice classification, and review-state APIs report separate approved versions. |  |  |
| Open project exports. | `/app/projects/[projectId]/exports` shows approved semantic, support, and classification counts. |  |  |
| Select export targets and create export as `OWNER`. | Export completes and shows manifest/package download links; integrity warnings block export when selected inputs lack checksum/dimensions. |  |  |
| Download or open manifest/package links. | Downloads are served through `/api/exports/[exportId]/download` without exposing MinIO URLs. |  |  |
| If a prediction run fixture exists, inspect the prediction analysis export section. | Candidate counts, metric-ready count, missing-reference count, target controls, prediction-run selection, and proposal warning render separately from the training export controls. |  |  |
| Create a prediction analysis export as `OWNER` or `QA`. | Export completes with `/api/prediction-analysis-exports/[exportId]/download` links, shows QA metrics computed/not-computed summary when available, and clearly labels predictions as proposals, not training labels. |  |  |
| If a batch prediction ZIP fixture exists, open project prediction imports and create/process a batch as `OWNER` or `QA`. | `/app/projects/[projectId]/prediction-imports` shows batch counts, item failures show stable error codes, successful items become prediction proposals, and no private staging/MinIO URL is exposed. |  |  |
| If testing the RB-065 worker path, run one script pass for due batches. | `npm run jobs:prediction-import -- --limit 25 --max-jobs 5 --email '<owner-or-qa-email>' --password '<password>'` processes due batches without a browser tab and logs processor/run summary without secrets. |  |  |
| If testing RB-066 cleanup, run storage cleanup dry-run after batch processing. | `npm run storage:cleanup -- --category batch-staging --batch '<batch-id>' --email '<admin-email>' --password '<password>'` reports candidates without deleting committed raw images, prediction artifacts, or exports. |  |  |
| If a prediction run/task fixture exists, open `/app/projects/[projectId]/tasks`. | Correction task queue renders and the task has an `Open correction` link. |  |  |
| Open a correction task. | `/app/projects/[projectId]/tasks/[taskId]/correct` loads image, task context, and prediction proposal panel. |  |  |
| Toggle prediction overlay and click `Use prediction as starting mask`. | Prediction bytes copy into the editable human layer; no save occurs until explicitly requested. |  |  |
| Click `Save correction draft`. | A draft human correction version is saved and appears in existing review controls. |  |  |
| Log out if testing session end. | Protected routes redirect to login. |  |  |
| If practical, set a stale `sapen_annotate_session` cookie and open a protected `/app/...` URL. | Browser redirects to `/login?next=...` instead of showing a 500. |  |  |
| Open `/api/projects` in a fresh unauthenticated browser/session. | Response is JSON `401` with `UNAUTHENTICATED`, not an HTML login page. |  |  |

## Current MVP Limitations

- Advanced export filters/history, multi-object support geometry, and slice-specific metadata workflows are not implemented.
- Image-level/default sample metadata exists; it does not yet model different metadata per slice instance.
- RB-051 supports one default slice/support geometry per image.
- RB-070 adds explicit Eraser UX for semantic and support masks; background-label painting remains valid.
- Advanced iPad gestures are deferred and must not be inferred from this desktop smoke.
- Automated browser coverage remains focused and protects metadata save/reload, semantic mask save, support mask save, slice classification persistence, the owner review happy path, creation of a training export with manifest/package links, a small assisted-correction happy path, and RB-072 representative API JSON error contracts. Prediction-analysis exports and RB-067 QA metrics, RB-061/RB-065 batch prediction imports, and RB-066 storage cleanup are covered by DB/domain integration tests rather than full browser workflows.

## Result Tracking

| Environment | Tester | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| Local desktop browser |  |  |  |  |
| Trial desktop browser |  |  |  |  |
