# Manual Smoke - Editor Desktop And iPad

## Purpose

This checklist verifies the current browser editor baseline for a customer trial. It is manual by design; Codex cannot validate real iPad Safari or Apple Pencil behavior in this environment.

## Preconditions

- Local infra is running and seeded with `npm run db:rebuild` or `npm run db:bootstrap`.
- Development server is running with `npm run dev`.
- Seed login exists: `admin@sapen.local` / `admin1234`.
- At least one project exists; the seed creates `Demo Project`.
- A representative wood-slice image is available for upload.
- For customer-facing iPad testing, prefer the deployed HTTPS URL and named tester accounts from [manual-smoke-customer-browser-trial.md](manual-smoke-customer-browser-trial.md).

## Desktop Browser Smoke

| Step | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Open `/login`. | Login form renders without console errors. |  |  |
| Log in as `admin@sapen.local`. | Browser lands in the workspace and receives a session cookie. |  |  |
| Open `/app/projects`. | Project list renders. |  |  |
| Open or create a project. | Project page renders with image navigation. |  |  |
| Upload a representative image. | Image appears in the project image list. |  |  |
| Open the editor. | Image loads and editor controls are visible. |  |  |
| Select each label. | Active label state is visible and touch target remains stable. |  |  |
| Select Brush and draw with mouse. | Mask overlay follows the pointer and page does not scroll unexpectedly. |  |  |
| Select Lasso and draw a freehand region. | Region commits as a mask change after pointer up. |  |  |
| Select Polygon and create a polygon. | Handles render; Enter/double-click/closing near first point commits the region. |  |  |
| Use Undo and Redo. | Mask state changes predictably. |  |  |
| Draw, then wait for autosave or click Save now. | Dirty state clears after save. |  |  |
| Reload the editor route. | Latest saved mask reloads. |  |  |
| Try leaving the page while dirty. | Browser shows unsaved-change protection. |  |  |
| Inspect console during normal use. | No unexpected runtime errors. |  |  |

## iPad Safari Smoke

## Deferred Gate: Real iPad Safari Trial

Status: Not executed in RB-047.

Required before customer pilot: yes.

Reason: deployment/device access is unavailable during RB-047. The Playwright iPad viewport preparation smoke is not a substitute for real iPad Safari and Apple Pencil validation.

Required environment:

- Deployed HTTPS SaPen Annotate trial URL.
- Named tester account with project access.
- iPad running current iPadOS Safari.
- Apple Pencil if available for the pilot workflow.

Blocking failure criteria:

- Login or session persistence fails on iPad Safari.
- Editor canvas cannot load images or saved masks.
- Finger/Pencil drawing does not update the mask.
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
| Draw with finger using Brush. | Mask draws; canvas does not scroll the page while drawing. |  |  |
| Draw with Apple Pencil if available. | Pencil draws through Pointer Events. |  |  |
| Touch outside the canvas and scroll. | Page/editor container scrolling remains possible outside drawing surface. |  |  |
| Change labels and tools by touch. | Controls are large enough and active state is clear. |  |  |
| Try freehand Lasso with finger/Pencil. | Region commits on pointer up; cancellation does not commit partial lasso. |  |  |
| Try Polygon with touch. | Points and handles are usable enough for a trial. |  |  |
| Save and reload. | Saved mask persists after reload. |  |  |
| Rotate iPad or change viewport. | Fit/zoom remains usable; document any layout issue. |  |  |
| Inspect Safari console if available. | No unexpected runtime errors. |  |  |

## Result Tracking

| Environment | Tester | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| Desktop browser |  |  |  |  |
| iPad Safari - finger |  |  |  |  |
| iPad Safari - Apple Pencil |  |  |  |  |

## Known Limitations

- Advanced multi-touch zoom/pan gestures are not implemented in RB-045.
- The editor still uses the MVP `MaskKind.REFINED` save path until the annotation domain schema is redesigned.
- This checklist does not replace automated browser tests; it is the current customer-trial smoke baseline.
