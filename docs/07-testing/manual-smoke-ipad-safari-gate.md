# Manual Smoke - iPad Safari Customer Trial Gate

## Status

Real iPad Safari Gate status: pending until deployed URL and device access are available.

Do not mark this gate as passed unless it has been executed on a real iPad Safari device against the deployed trial URL.

## Preconditions

- Deployed HTTPS URL from [../04-server/deployment-trial.md](../04-server/deployment-trial.md).
- Named trial user with project access; do not use shared demo credentials unless explicitly accepted.
- Representative project with at least one PNG/JPEG wood-slice image.
- iPad running Safari on the target iPadOS version.
- Apple Pencil if Pencil input is part of the pilot.
- Backup status accepted or completed according to [../04-server/backup-restore.md](../04-server/backup-restore.md).

## Test Record

| Field | Value |
| --- | --- |
| Deployed URL |  |
| iPad model |  |
| iPadOS version |  |
| Safari version |  |
| Home-Screen launch tested |  |
| Tester |  |
| Date |  |
| Named trial user |  |
| Project/Image |  |
| Overall result | Pending / Pass / Fail |

## Blocking Failure Criteria

- HTTPS trial URL cannot be opened on iPad Safari.
- Login or session persistence fails.
- Project navigation or image/editor load fails.
- Finger or Apple Pencil drawing does not update the mask.
- Drawing on the canvas scrolls the page instead of drawing.
- Scrolling outside the canvas is impossible.
- Save/reload loses semantic mask, support mask, or classification state.
- Controls overlap or become unusable in portrait or landscape.
- Home-Screen launch fails when installed-app behavior is part of the pilot.

Non-blocking issues should still be recorded with screenshots or video when possible.

## Gate Checklist

| Step | Expected Result | Blocking? | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Open deployed HTTPS URL in iPad Safari. | Login page renders without TLS warning. | Yes |  |  |
| Add app to Home Screen if testing installed launch. | Icon/name render and launch opens the app route. | Yes if pilot requires it |  |  |
| Log in as named trial user. | Workspace opens and session persists after reload. | Yes |  |  |
| Open project list and project. | Project navigation fits the viewport. | Yes |  |  |
| Open image metadata. | Technical metadata, readiness, T-number, and acquisition fields are reachable. | Yes |  |  |
| Save or inspect T-number and metadata. | Save/reload persists values without overlap. | Yes |  |  |
| Open editor. | Image, canvas, toolbar, semantic labels, support mode, review controls, and save controls render. | Yes |  |  |
| Draw semantic mask with finger. | Mask overlay updates; canvas does not scroll page while drawing. | Yes |  |  |
| Select Eraser and erase semantic mask with finger. | Eraser writes background, uses the brush size control, and does not scroll the page. | Yes |  |  |
| Draw semantic mask with Apple Pencil if available. | Pencil input draws through Pointer Events. | Yes if Pencil is part of pilot |  |  |
| Touch outside canvas and scroll. | Page/editor container scrolls outside the drawing surface. | Yes |  |  |
| Switch labels/tools by touch. | Touch targets are usable and active state is visible. | Yes |  |  |
| Switch to slice support mode. | Support mode is distinct from semantic labels and controls fit. | Yes |  |  |
| Draw and save support mask. | Support mask save completes and persists after reload. | Yes |  |  |
| Erase part of the support mask. | Eraser writes support background, not semantic Copper/background confusion. | Yes |  |  |
| Set slice classification. | Classification persists after save and reload. | Yes |  |  |
| Submit/review/approve if role permits. | Review controls work or are hidden/disabled according to role. | Yes for reviewer role |  |  |
| Open project exports if role permits. | Readiness counts and export controls fit the viewport. | Yes for owner/QA route |  |  |
| Create/download export if role permits and data is ready. | App-mediated download works without exposing MinIO URLs. | No |  |  |
| Open correction task if prediction fixture exists. | Assisted correction route loads prediction context and overlay controls. | No |  |  |
| Use prediction as starting mask if fixture exists. | Human correction draft remains separate from read-only prediction. | No |  |  |
| Rotate to landscape. | Layout remains usable; fit/zoom still works. | Yes |  |  |
| Rotate to portrait. | Layout remains usable; no controls overlap. | Yes |  |  |
| Inspect Safari console if available. | No unexpected runtime errors. | No |  |  |

## Issue Log

| Step | Expected | Actual | Blocking | Evidence | Follow-up |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |
