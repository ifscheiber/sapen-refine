# Manual Smoke - Desktop Browser MVP

## Purpose

This checklist verifies the current desktop browser MVP workflow after the RB-051 slice-support workflow. It targets the local or trial-deployed browser app and does not require iPad Safari.

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
| Switch to `Slice support`. | Support mode loads separately from semantic mask mode. |  |  |
| Draw a support mask and save. | Support-mask status shows a draft version after save. |  |  |
| Set slice classification. | Classification persists and is visible after save. |  |  |
| Reload editor. | Latest saved mask reloads without runtime errors. |  |  |
| Confirm semantic/support distinction. | Semantic latest mask and support latest mask both exist through their separate APIs. |  |  |
| Log out if testing session end. | Protected routes redirect to login. |  |  |

## Current MVP Limitations

- Review/approval, export, multi-object support geometry, and slice-specific metadata workflows are not implemented.
- Image-level/default sample metadata exists; it does not yet model different metadata per slice instance.
- RB-051 supports one default slice/support geometry per image.
- Advanced iPad gestures are deferred and must not be inferred from this desktop smoke.
- Automated browser coverage remains focused and protects metadata save/reload, semantic mask save, support mask save, and slice classification persistence.

## Result Tracking

| Environment | Tester | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| Local desktop browser |  |  |  |  |
| Trial desktop browser |  |  |  |  |
