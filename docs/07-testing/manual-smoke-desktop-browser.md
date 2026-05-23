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
| If practical, upload a full-resolution image near 6000x4000. | Editor opens only after the full-size canvas/mask buffer are ready; saving a tiny semantic stroke completes without `MASK_BYTE_LENGTH_MISMATCH`. |  |  |
| If practical, upload a large image above 6000x4000 and no larger than 8000x6000. | Image uploads with a large-image memory warning. |  |  |
| If practical, upload an image above the trial editor policy. | Upload fails with `IMAGE_DIMENSIONS_UNSUPPORTED`. |  |  |
| Try an unsupported image type if practical. | Upload fails with `UNSUPPORTED_CONTENT_TYPE` and no private storage URL is exposed. |  |  |
| Open image metadata. | Technical metadata includes content type, size, checksum, dimensions, validation status, T-number state, and readiness summary without exposing private storage URLs. |  |  |
| Enter T-number and basic acquisition metadata. | Metadata saves successfully. |  |  |
| Reload image metadata. | T-number and acquisition fields persist. |  |  |
| Open editor. | Image, canvas stack, tools, labels, zoom, and save controls render. |  |  |
| Select `BBox proposal` and draw a rough rectangle around a slice. | A slice proposal appears in the BBox list and is clearly labeled as a proposal, not ground truth. |  |  |
| Click `Generate crop` for the selected BBox proposal. | A crop preview appears with crop dimensions and padding metadata; no support mask or export-ready state is implied by the crop alone. |  |  |
| Click `Open support editor` for the generated crop. | The crop support editor opens at a deep link and displays the crop image in crop coordinates. |  |  |
| Draw and erase in the crop support editor, then click `Save support mask`. | A draft crop support mask saves, reloads, and remains linked to the crop; Copper semantic labels are not shown in this editor. |  |  |
| Click `Semantic` or `Open semantic editor` for the generated crop. | The crop semantic editor opens at a deep link, shows the support overlay, and offers Sap/Heartwood and Copper modes. |  |  |
| Paint Sapwood/Heartwood inside support and save. | A draft crop semantic mask saves, reloads, records the current support version as its constraint, and creates a draft auto slice-classification suggestion. |  |  |
| Override the crop slice classification. | A new manual classification version is saved without replacing the auto suggestion. |  |  |
| Paint near the support boundary. | Brush changes are constrained to support pixels; outside-support semantic foreground cannot be saved. |  |  |
| Reload the editor after creating the BBox proposal and crop. | The BBox proposal and crop preview remain visible; no support mask or export-ready state is implied by the BBox/crop alone. |  |  |
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
- RB-051 supports one default pixel-perfect slice/support geometry per image.
- RB-086/RB-087/RB-088/RB-089/RB-090 support source-image BBox slice proposals, derived crop previews, crop support-mask editing, support-constrained crop semantic editing, and draft auto classification suggestions/manual overrides. Crop-aware review/export integration remains deferred.
- RB-070 adds explicit Eraser UX for semantic and support masks; background-label painting remains valid.
- RB-080/RB-081 keep full-resolution editing as the current model and verify 6000x4000 mask upload payloads plus the real semantic save route in automated desktop Chrome. Tiled/downscaled working masks remain deferred unless real iPad Safari or customer hardware proves full-resolution editing unreliable.
- Advanced iPad gestures are deferred and must not be inferred from this desktop smoke.
- Automated browser coverage remains focused and protects metadata save/reload, semantic mask save, support mask save, slice classification persistence, the owner review happy path, creation of a training export with manifest/package links, a small assisted-correction happy path, and RB-072 representative API JSON error contracts. Prediction-analysis exports and RB-067 QA metrics, RB-061/RB-065 batch prediction imports, and RB-066 storage cleanup are covered by DB/domain integration tests rather than full browser workflows.

## Result Tracking

| Environment | Tester | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| Local desktop browser |  |  |  |  |
| Trial desktop browser |  |  |  |  |
