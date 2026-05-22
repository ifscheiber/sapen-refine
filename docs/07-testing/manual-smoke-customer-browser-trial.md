# Manual Smoke - Customer Browser Trial

## Purpose

This checklist verifies a deployed customer-trial browser path on desktop and iPad Safari. It is manual by design; Codex cannot validate real iPad Safari or Apple Pencil behavior in this environment.

## Preconditions

- Trial deployment follows [../04-server/deployment-trial.md](../04-server/deployment-trial.md).
- HTTPS URL is available through Caddy.
- `/api/health` and `/api/ready` are reachable.
- Named trial users exist; do not use shared demo credentials unless explicitly accepted.
- A backup has been taken or the operator accepts the data-loss window described in [../04-server/backup-restore.md](../04-server/backup-restore.md).
- Representative PNG/JPEG wood-slice images are available, including one image near the expected upper trial size.

## Deployment Smoke

| Step | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Check `deploy/trial.env`. | Hostname, app URL, DB, S3, and upload limits are set with non-placeholder secrets. |  |  |
| Run `docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml ps`. | `caddy`, `app`, `postgres`, and `minio` are running or healthy. |  |  |
| Run the `migrate` service. | `prisma migrate deploy` completes without using `migrate dev`. |  |  |
| Run `npm run trial:bootstrap` through Compose. | Global roles and the default label schema exist without creating shared demo users or demo projects. |  |  |
| Create named trial users through Compose. | At least one named global admin/project owner and one named project labeler exist; no shared demo credentials are used unless explicitly accepted. |  |  |
| Open `/api/health`. | Returns `status: ok`. |  |  |
| Open `/api/ready`. | Returns `status: ok`; failures name only dependency checks. |  |  |
| Open HTTPS app URL. | Redirects to login without TLS warnings. |  |  |
| Log in with a named tester. | Workspace opens and session persists after reload. |  |  |
| Log out if testing logout. | Session is cleared and protected routes redirect to login. |  |  |
| Open `/api/projects` without a session. | Returns JSON `401 UNAUTHENTICATED`; browser pages still redirect to `/login`. |  |  |
| Confirm public exposure. | Only Caddy is reachable publicly; MinIO console/S3 are not exposed. |  |  |
| Run backup command or confirm backup schedule. | PostgreSQL, MinIO, and Caddy backup procedure is documented for this trial. |  |  |
| If enabling batch prediction imports, set named worker credentials and start optional worker. | `SAPEN_JOB_EMAIL`/`SAPEN_JOB_PASSWORD` belong to a named owner/QA account; `prediction-import-worker` runs only when the `worker` profile is enabled. |  |  |
| If enabling cleanup operations, set named admin cleanup credentials or prepare an admin login. | `SAPEN_CLEANUP_EMAIL`/`SAPEN_CLEANUP_PASSWORD` belong to a named global admin account; cleanup dry-run is available before execute. |  |  |

## Desktop Browser Smoke

| Step | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Open deployed HTTPS URL on a large desktop browser. | Layout fits without overlapping controls. |  |  |
| Log in as named tester. | User identity is attributable in the session. |  |  |
| Open workspace and project list. | Project navigation renders. |  |  |
| Create or open a project. | Project page and image list render. |  |  |
| Upload a normal representative PNG/JPEG image. | Image uploads through the app and appears in the list. |  |  |
| Upload a representative full-resolution image near `6000x4000`, if available. | Editor readiness waits for actual image/canvas/mask dimensions, and saving a tiny semantic stroke succeeds without `MASK_BYTE_LENGTH_MISMATCH`. |  |  |
| Upload a large image above `6000x4000` but no larger than `8000x6000`, if available. | Image is accepted with a visible large-image/iPad memory warning; save still succeeds. |  |  |
| Upload an intentionally unsupported-dimension image if available. | Request fails with `IMAGE_DIMENSIONS_UNSUPPORTED`; proxy/Caddy limits are not hit first. |  |  |
| Upload an unsupported file type if available. | Request fails with `UNSUPPORTED_CONTENT_TYPE`; no image row or private storage URL is exposed. |  |  |
| Open image metadata. | Technical metadata, checksum, dimensions, readiness summary, and editable metadata sections render without exposing MinIO/S3 URLs. |  |  |
| Enter T-number and acquisition metadata. | Save succeeds and metadata persists after reload. |  |  |
| Open editor. | Image loads, canvas is usable, controls are visible. |  |  |
| Draw with brush and lasso. | Mask overlay follows input and changes can be saved. |  |  |
| Select Eraser and erase part of the semantic mask. | Eraser is discoverable, uses brush size, writes background, and can be saved. |  |  |
| Save semantic mask. | Semantic mask save completes and persists. |  |  |
| Switch to `Slice support`. | UI clearly indicates support mode, separate from semantic labels. |  |  |
| Draw and save support mask. | Support-mask status shows a draft version. |  |  |
| Select Eraser in support mode and erase part of the support mask. | Eraser writes support background and remains separate from semantic Copper labels. |  |  |
| Set slice classification. | Classification persists after save. |  |  |
| Submit and approve semantic mask, support mask, and slice classification. | Review state shows approved versions and export-ready becomes yes. |  |  |
| Reload. | Semantic mask, support mask status, classification, and approved review state reload. |  |  |
| Open project exports and create a training export as owner. | `/app/projects/[projectId]/exports` readiness counts include the approved components and export creation returns manifest/package download links. Integrity warnings block export creation if selected inputs lack checksum/dimensions. |  |  |
| Download manifest and package. | Files download through app routes; no MinIO console/S3 URL is exposed to the browser. |  |  |
| If a prediction fixture exists, create a prediction analysis export as owner/QA. | Export completes through `/api/prediction-analysis-exports/*`, warning text says predictions are proposals, QA metrics summary appears when approved references exist, and no private storage URL is exposed. |  |  |
| If a batch prediction ZIP fixture exists, open project prediction imports and create a prediction import batch as owner/QA. | `/app/projects/[projectId]/prediction-imports` shows item counts; process/retry controls work; failed items show stable error codes; no staging or MinIO/S3 URL is exposed. |  |  |
| If the worker profile is enabled, inspect worker logs after batch upload. | Worker processes bounded due batches, reports processor/run summary, and does not log credentials, session tokens, or private storage keys. |  |  |
| Run storage cleanup dry-run after any batch-import test data. | `npm run storage:cleanup -- --dry-run` reports only temporary/staged candidates and does not list committed raw images, artifact versions, or exports as deletable. |  |  |
| If a prediction fixture exists, open project task queue. | Active-learning correction tasks render without exposing storage keys. |  |  |
| Open a correction task. | Assisted correction editor loads prediction context and image at `/tasks/[taskId]/correct`. |  |  |
| Use prediction as starting mask and save correction draft. | Human correction draft is saved separately; prediction remains read-only. |  |  |
| Inspect browser console. | No unexpected runtime errors. |  |  |

## iPad Safari Smoke

Use the dedicated customer-pilot gate in [manual-smoke-ipad-safari-gate.md](manual-smoke-ipad-safari-gate.md) for the authoritative real-device pass/fail record. The table below remains a short combined smoke checklist.

## Deferred Gate: Real iPad Safari Trial

Status: Pending until deployed URL and device access are available.

Required before customer pilot: yes.

Reason: the Strato/customer-trial deployment and real iPad Safari device access are not available during RB-047. The desktop E2E smoke and iPad viewport preparation smoke only reduce regression risk; they do not validate Safari, Apple Pencil, or Home-Screen behavior on a real device.

Required inputs before execution:

- Deployed HTTPS URL.
- Named tester account.
- Representative project and image.
- iPad Safari and Apple Pencil if Pencil input is part of the pilot.

Blocking failure criteria:

- HTTPS trial URL cannot be opened on iPad Safari.
- Login/session persistence fails.
- Home-Screen launch fails when testing installed app behavior.
- Editor image or latest mask cannot be loaded.
- Finger/Pencil drawing, save, or reload fails.
- Layout overlap prevents normal annotation controls from being used.

| Step | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Open deployed HTTPS URL in iPad Safari. | Login and layout fit the smaller viewport. |  |  |
| Add to Home Screen. | App launches with SaPen Annotate name/icon and opens at `/app`. |  |  |
| Log in as named tester. | Session persists across reload and Home-Screen launch. |  |  |
| Open project and image metadata. | Metadata form controls remain reachable without overlap. |  |  |
| Enter or inspect T-number and acquisition metadata. | Metadata fields fit the viewport and save/reload works. |  |  |
| Open editor. | Editor controls remain reachable without overlap. |  |  |
| Draw with finger using Brush. | Canvas draws and page does not scroll while drawing. |  |  |
| Select Eraser by touch and erase. | Eraser control is reachable and erasing uses the same brush-size workflow. |  |  |
| Switch to `Slice support`. | Mode switch and support controls fit the iPad viewport. |  |  |
| Save support mask and set classification. | Support state and classification persist after reload. |  |  |
| Inspect review controls. | Review state fits the iPad viewport without blocking normal editor controls. |  |  |
| Inspect project export panel. | Readiness counts and export controls fit the iPad viewport; owner-only behavior is clear. |  |  |
| If a prediction fixture exists, inspect prediction analysis export controls. | Proposal warning, metric availability counts, target checkboxes, prediction-run selector, and download links fit the iPad viewport. |  |  |
| If a batch prediction ZIP fixture exists, inspect prediction import controls. | Prediction-run selector, ZIP upload, counts, process/retry buttons, and item failures fit without horizontal-only desktop dependence. |  |  |
| If prediction task fixture exists, open correction task. | Prediction panel, overlay toggle, and save correction controls fit the iPad viewport. |  |  |
| Draw with Apple Pencil if available. | Pencil input draws through Pointer Events. |  |  |
| Touch outside the canvas and scroll. | Page/editor container scrolling remains possible outside drawing surface. |  |  |
| Change labels/tools by touch. | Touch targets are usable and active state is clear. |  |  |
| Save and reload. | Saved mask persists after reload. |  |  |
| Rotate iPad. | Fit/zoom remains usable; record any layout issue. |  |  |
| Inspect Safari console if available. | No unexpected runtime errors. |  |  |

## Result Tracking

| Environment | Tester | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| Deployment smoke |  |  |  |  |
| Desktop browser |  |  |  |  |
| iPad Safari - finger |  |  |  |  |
| iPad Safari - Apple Pencil |  |  |  |  |
| Backup restore drill |  |  |  |  |

## Known Limitations

- Advanced multi-touch zoom/pan gestures are not implemented.
- Explicit eraser UX exists after RB-070; real iPad Safari/Pencil behavior remains a manual gate.
- RB-080/RB-081 verify exact full-resolution mask upload payloads and the real semantic save route in desktop Chrome. Real iPad Safari must still be checked manually with representative large images; if memory or performance fails there, create a separate tiled/downscaled/patch-upload ticket.
- Real iPad Safari smoke is manual; automated coverage is limited to desktop Chrome and an iPad viewport preparation smoke.
- RB-068 is an internal editor decomposition; visible customer-trial editor behavior should remain unchanged.
- Image-level/default sample metadata exists; slice-specific metadata remains deferred.
- RB-051 supports one default slice/support geometry per image; multi-object editing remains deferred.
- RB-053 training export and RB-060/RB-067 prediction-analysis export generation are synchronous and trial-sized. RB-061/RB-065 prediction batch imports use bounded explicit or optional worker process passes. RB-066 storage cleanup is admin-only and dry-run first. Cleanup UI, production-scale queue infrastructure, advanced export filters/history, metrics dashboards, and large export job handling remain deferred.
- Assisted correction supports semantic/support mask predictions only; slice-classification correction remains deferred.
