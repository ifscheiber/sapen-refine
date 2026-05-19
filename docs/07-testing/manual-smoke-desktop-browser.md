# Manual Smoke - Desktop Browser MVP

## Purpose

This checklist verifies the current desktop browser MVP workflow after the RB-050 metadata slice. It targets the local or trial-deployed browser app and does not require iPad Safari.

## Preconditions

- Local stack is rebuilt or bootstrapped with `npm run db:rebuild` or equivalent trial deployment commands.
- App is running through `npm run dev`, `npm run start`, or the RB-046 trial Compose deployment.
- A named tester account or local seeded admin account exists.
- A small representative image fixture is available for upload.

## Desktop Workflow

| Step | Expected Result | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Open `/login`. | Login page renders without console errors. |  |  |
| Log in as a named tester or local seeded admin. | Browser lands in `/app` or the requested `next` route. |  |  |
| Open `/app/projects`. | Project list renders and session persists after reload. |  |  |
| Create a new project. | App redirects to the project detail route. |  |  |
| Open project image list. | Image list renders and upload control is visible for editable roles. |  |  |
| Upload a normal image. | Image uploads through the app and appears in the list. |  |  |
| Open image metadata. | Technical metadata, T-number state, and readiness summary render without exposing private storage URLs. |  |  |
| Enter T-number and basic acquisition metadata. | Metadata saves successfully. |  |  |
| Reload image metadata. | T-number and acquisition fields persist. |  |  |
| Open editor. | Image, canvas stack, tools, labels, zoom, and save controls render. |  |  |
| Draw with Brush. | Overlay changes and dirty state becomes visible. |  |  |
| Click `Save now`. | Save completes and dirty state clears. |  |  |
| Reload editor. | Latest saved mask reloads without runtime errors. |  |  |
| Log out if testing session end. | Protected routes redirect to login. |  |  |

## Current MVP Limitations

- Review/approval, export, support-mask, and slice-specific metadata workflows are not implemented.
- Image-level/default sample metadata exists; it does not yet model different metadata per slice instance.
- Advanced iPad gestures are deferred and must not be inferred from this desktop smoke.
- Automated browser coverage remains focused and protects metadata save/reload plus the MVP editor golden path.

## Result Tracking

| Environment | Tester | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| Local desktop browser |  |  |  |  |
| Trial desktop browser |  |  |  |  |
