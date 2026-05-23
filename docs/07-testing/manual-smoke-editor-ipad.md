# Manual Smoke - Editor Desktop And iPad

## Purpose

This checklist verifies the current browser editor baseline for a customer trial. It is manual by design; Codex cannot validate real iPad Safari or Apple Pencil behavior in this environment.

## Preconditions

- Local infra is running and seeded with `npm run db:rebuild` or `npm run db:bootstrap`.
- Development server is running with `npm run dev`.
- Seed login exists: `admin@sapen.local` / `admin1234`.
- At least one project exists; the seed creates `Demo Project`.
- A representative PNG/JPEG wood-slice image is available for upload.
- For customer-facing iPad testing, prefer the deployed HTTPS URL and named tester accounts from [manual-smoke-customer-browser-trial.md](manual-smoke-customer-browser-trial.md).

## Desktop Browser Smoke

| Step | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Open `/login`. | Login form renders without console errors. |  |  |
| Log in as `admin@sapen.local`. | Browser lands in the workspace and receives a session cookie. |  |  |
| Open `/app/projects`. | Project list renders. |  |  |
| Open or create a project. | Project page renders with image navigation. |  |  |
| Upload a representative PNG/JPEG image. | Image appears in the project image list with validated technical metadata. |  |  |
| Open the editor. | Image loads and editor controls are visible. |  |  |
| Select `BBox proposal` and draw a rough slice box. | A slice proposal appears and reloads as a proposal, not ground truth. |  |  |
| Click `Generate crop` for the selected BBox proposal. | A crop preview appears and reloads as a derived editing artifact, not support geometry. |  |  |
| Select each label. | Active label state is visible and touch target remains stable. |  |  |
| Select Brush and draw with mouse. | Mask overlay follows the pointer and page does not scroll unexpectedly. |  |  |
| Select Eraser and erase part of the mask. | Eraser uses the brush size, writes background, and participates in dirty/save state. |  |  |
| Select Lasso and draw a freehand region. | Region commits as a mask change after pointer up. |  |  |
| Select Polygon and create a polygon. | Handles render; Enter/double-click/closing near first point commits the region. |  |  |
| Use Undo and Redo. | Mask state changes predictably. |  |  |
| Draw, then wait for autosave or click Save now. | Dirty state clears after save. |  |  |
| Submit and approve semantic/support/classification versions if using an `OWNER`/`QA` account. | Review controls remain usable and export-ready state updates. |  |  |
| Reload the editor route. | Latest saved mask reloads. |  |  |
| Try leaving the page while dirty. | Browser shows unsaved-change protection. |  |  |
| Inspect console during normal use. | No unexpected runtime errors. |  |  |

## iPad Safari Smoke

## Deferred Gate: Real iPad Safari Trial

Status: Pending until deployed URL and real iPad Safari device access are available. The authoritative customer-pilot gate is [manual-smoke-ipad-safari-gate.md](manual-smoke-ipad-safari-gate.md).

Required before customer pilot: yes.

Reason: deployment/device access is unavailable in the local Codex environment. The Playwright iPad viewport preparation smoke is not a substitute for real iPad Safari and Apple Pencil validation.

Required environment:

- Deployed HTTPS SaPen Annotate trial URL.
- Named tester account with project access.
- iPad running current iPadOS Safari.
- Apple Pencil if available for the pilot workflow.

Blocking failure criteria:

- Login or session persistence fails on iPad Safari.
- Editor canvas cannot load images or saved masks.
- Finger/Pencil drawing does not update the mask.
- Finger/Pencil BBox proposal drawing fails if crop proposal workflow is part of the pilot.
- Drawing scrolls the page instead of drawing on the canvas.
- Save/reload loses the latest mask.
- Controls overlap or become unusable on the iPad viewport.

Failure logging template:

```text
Device/iPadOS:
Browser:
URL:
Tester:
Project/Image:
Step:
Expected:
Actual:
Screenshot/video:
Blocking: yes/no
```

| Step | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Open app in Safari on iPad. | Layout fits viewport without overlapping controls. |  |  |
| Add deployed app to Home Screen if testing trial deployment. | Home-Screen icon/name render and launch opens the app. |  |  |
| Log in. | Workspace opens and session persists. |  |  |
| Open an uploaded image in the editor. | Image and controls render. |  |  |
| Open a large image above `6000x4000` and no larger than `8000x6000` if available. | Large-image memory warning is visible; editor remains usable. |  |  |
| Select `BBox proposal` and draw a rough slice box with finger/Pencil. | Proposal appears in the BBox list and persists after reload without page scrolling during the draw. |  |  |
| Tap `Generate crop` for the selected BBox proposal. | Crop preview, padding, and clipped-state text remain readable and reload. |  |  |
| Draw with finger using Brush. | Mask draws; canvas does not scroll the page while drawing. |  |  |
| Select Eraser by touch and erase part of the mask. | Eraser touch target is usable and erasing does not scroll the page. |  |  |
| Draw with Apple Pencil if available. | Pencil draws through Pointer Events. |  |  |
| Touch outside the canvas and scroll. | Page/editor container scrolling remains possible outside drawing surface. |  |  |
| Change labels and tools by touch. | Controls are large enough and active state is clear. |  |  |
| Try freehand Lasso with finger/Pencil. | Region commits on pointer up; cancellation does not commit partial lasso. |  |  |
| Try Polygon with touch. | Points and handles are usable enough for a trial. |  |  |
| Save and reload. | Saved mask persists after reload. |  |  |
| Inspect review controls. | Submit/approve controls fit and do not block drawing or scrolling. |  |  |
| Rotate iPad or change viewport. | Fit/zoom remains usable; document any layout issue. |  |  |
| Inspect Safari console if available. | No unexpected runtime errors. |  |  |

## Result Tracking

| Environment | Tester | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| Desktop browser |  |  |  |  |
| iPad Safari - finger |  |  |  |  |
| iPad Safari - Apple Pencil |  |  |  |  |

## Known Limitations

- Advanced multi-touch zoom/pan gestures are not implemented.
- RB-070 adds explicit eraser UX; real iPad Safari/Pencil behavior still needs the manual gate.
- RB-086/RB-087/RB-088 BBox proposals, derived crops, and crop support-mask editing are available; crop semantic editing remains a later workflow slice.
- Current editor review controls are minimal; reviewer dashboards and bulk review remain separate follow-up slices. RB-053 export testing is covered by the desktop/customer browser smoke checklists through the project exports route.
- This checklist does not replace automated browser tests; it is the current customer-trial smoke baseline.
