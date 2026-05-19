# Manual Smoke - Customer Browser Trial

## Purpose

This checklist verifies a deployed customer-trial browser path on desktop and iPad Safari. It is manual by design; Codex cannot validate real iPad Safari or Apple Pencil behavior in this environment.

## Preconditions

- Trial deployment follows [../04-server/deployment.md](../04-server/deployment.md).
- HTTPS URL is available through Caddy.
- `/api/health` and `/api/ready` are reachable.
- Named trial users exist; do not use shared demo credentials unless explicitly accepted.
- A backup has been taken or the operator accepts the data-loss window described in [../04-server/backup-restore.md](../04-server/backup-restore.md).
- Representative wood-slice images are available, including one image near the expected upper trial size.

## Deployment Smoke

| Step | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Check `deploy/trial.env`. | Hostname, app URL, DB, S3, and upload limits are set with non-placeholder secrets. |  |  |
| Run `docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml ps`. | `caddy`, `app`, `postgres`, and `minio` are running or healthy. |  |  |
| Run the `migrate` service. | `prisma migrate deploy` completes without using `migrate dev`. |  |  |
| Open `/api/health`. | Returns `status: ok`. |  |  |
| Open `/api/ready`. | Returns `status: ok`; failures name only dependency checks. |  |  |
| Open HTTPS app URL. | Redirects to login without TLS warnings. |  |  |
| Log in with a named tester. | Workspace opens and session persists after reload. |  |  |
| Log out if testing logout. | Session is cleared and protected routes redirect to login. |  |  |
| Confirm public exposure. | Only Caddy is reachable publicly; MinIO console/S3 are not exposed. |  |  |
| Run backup command or confirm backup schedule. | PostgreSQL, MinIO, and Caddy backup procedure is documented for this trial. |  |  |

## Desktop Browser Smoke

| Step | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Open deployed HTTPS URL on a large desktop browser. | Layout fits without overlapping controls. |  |  |
| Log in as named tester. | User identity is attributable in the session. |  |  |
| Open workspace and project list. | Project navigation renders. |  |  |
| Create or open a project. | Project page and image list render. |  |  |
| Upload a normal representative image. | Image uploads through the app and appears in the list. |  |  |
| Upload an intentionally too-large image if available. | Request fails with controlled `UPLOAD_TOO_LARGE` or documented Caddy `413`. |  |  |
| Open editor. | Image loads, canvas is usable, controls are visible. |  |  |
| Draw with brush and lasso. | Mask overlay follows input and changes can be saved. |  |  |
| Save and reload. | Latest mask reloads after route reload. |  |  |
| Inspect browser console. | No unexpected runtime errors. |  |  |

## iPad Safari Smoke

| Step | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Open deployed HTTPS URL in iPad Safari. | Login and layout fit the smaller viewport. |  |  |
| Add to Home Screen. | App launches with SaPen Annotate name/icon and opens at `/app`. |  |  |
| Log in as named tester. | Session persists across reload and Home-Screen launch. |  |  |
| Open project and editor. | Editor controls remain reachable without overlap. |  |  |
| Draw with finger using Brush. | Canvas draws and page does not scroll while drawing. |  |  |
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
- Browser smoke is manual; automated browser coverage remains deferred.
- The MVP schema still uses `MaskKind.REFINED` until a domain-model ticket replaces legacy terminology.
