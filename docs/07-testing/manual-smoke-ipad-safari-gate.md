# Manual Smoke - iPad Safari Customer Trial Gate

## Status

Real iPad Safari Gate status: pending until deployed URL and device access are available. RB-076 completed only a local desktop/Caddy dry run and does not count as this gate. Manual execution is tracked by `tickets/deferred/RB-077-B-real-ipad-safari-trial-gate-execution.md`.

Do not mark this gate as passed unless it has been executed on a real iPad Safari device against the deployed trial URL.

## Preconditions

- Deployed HTTPS URL from [../04-server/deployment-trial.md](../04-server/deployment-trial.md).
- Named trial user with project access; do not use shared demo credentials unless explicitly accepted.
- Representative project with at least one PNG/JPEG wood-slice image, including a larger full-resolution image near the expected trial upper size if practical.
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
| Role |  |
| Apple Pencil available | Yes / No |
| Network |  |
| Project/Image |  |
| Overall result | Pending / Pass / Fail |

## Blocking Failure Criteria

- HTTPS trial URL cannot be opened on iPad Safari.
- Login or session persistence fails.
- Project navigation or image/editor load fails.
- Finger or Apple Pencil drawing does not update the mask.
- Finger or Apple Pencil BBox proposal drawing fails when BBox mode is part of the pilot workflow.
- Drawing on the canvas scrolls the page instead of drawing.
- Scrolling outside the canvas is impossible.
- Save/reload loses semantic mask, support mask, or classification state.
- Crop semantic editing or save/reload fails when the crop workflow is part of the pilot.
- Controls overlap or become unusable in portrait or landscape.
- Home-Screen launch fails when installed-app behavior is part of the pilot.

Non-blocking issues should still be recorded with screenshots or video when possible.

## Result Classification

Classify every failed or surprising step as one of:

- `BLOCKER` - prevents the customer pilot or normal annotation path.
- `MAJOR` - materially harms annotation speed, confidence, or data integrity but has a workaround.
- `MINOR` - visible defect or inconvenience that does not block the pilot.
- `OBSERVATION` - noteworthy behavior without immediate fix requirement.

Evidence should include short notes and, when practical, a screenshot, photo, screen recording, Safari console note, or network note plus a follow-up ticket id.

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
| Open a larger full-resolution image if available. | For images above `6000x4000` and no larger than `8000x6000`, the large-image warning is visible, editor readiness completes, controls remain usable, and no `MASK_BYTE_LENGTH_MISMATCH` appears during save. | Yes if large images are part of pilot |  |  |
| Select `BBox proposal` and draw a rough slice box with finger. | A BBox proposal appears in the slice proposal list, persists after reload, and the canvas does not scroll page while drawing. | Yes if crop workflow is part of pilot |  |  |
| Tap `Generate crop` for the selected BBox proposal. | A crop preview appears and reloads; the preview does not imply support-mask or export readiness. | Yes if crop workflow is part of pilot |  |  |
| Tap `Open support editor` for the generated crop. | The crop support editor opens, displays the crop image, and keeps drawing in crop coordinates. | Yes if crop workflow is part of pilot |  |  |
| Draw and erase a crop support mask, then save. | A draft crop support mask saves and reloads; only support/background labels are available. | Yes if crop workflow is part of pilot |  |  |
| Open the generated crop semantic editor. | The crop semantic editor opens, shows the support overlay, and mode/tool controls fit the viewport. | Yes if crop workflow is part of pilot |  |  |
| Draw and save a crop semantic mask inside support. | Brush strokes stay constrained to support pixels, save succeeds, reload preserves the draft, and a draft auto classification suggestion appears. | Yes if crop workflow is part of pilot |  |  |
| Draw a BBox proposal with Apple Pencil if available. | Pencil input creates a BBox through Pointer Events. | Yes if Pencil and crop workflow are part of pilot |  |  |
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
| Log out. | Session ends and login route is reachable again. | No |  |  |

## Issue Log

| Step | Expected | Actual | Classification | Evidence | Follow-up |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |
