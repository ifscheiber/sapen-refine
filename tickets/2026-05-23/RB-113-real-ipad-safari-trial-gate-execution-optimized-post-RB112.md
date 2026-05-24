# RB-113 - Real iPad Safari Trial Gate Execution (Post-RB-112)

## Status

Planned / Manual Gate

## Priority

P2

## Type

iPad Validation / Customer Trial Gate / Manual Evidence / Mobile Safari / Export UX Validation

## Source

- `tickets/deferred/RB-077-B-real-ipad-safari-trial-gate-execution.md`
- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- Completed RB-111: high-cost rate limits and export caps.
- Completed RB-112: async export job processing.

## Depends On

- Completed RB-105 through RB-112 baseline.
- Deployed HTTPS trial URL.
- Named test account with suitable project/member permissions.
- Physical iPad with Safari access.
- Optional but strongly preferred: Apple Pencil for drawing validation.
- A known small/medium test dataset that stays within RB-111 high-cost limits and export caps.
- Export processing available through either:
  - the deployed export worker/loop, or
  - an operator-triggered `npm run exports:process` / `/api/export-jobs/process-due` path.

## Blocks

- Any production or customer-facing support claim for iPad/tablet annotation.
- Any claim that the crop/slice editor workflow is validated on real Mobile Safari.
- Any claim that async export status/download UX works on iPad Safari.

## Context

Automated desktop and iPad-sized viewport tests exist, but they do not validate real Safari behavior on a physical iPad.

The repo has now moved materially beyond the older deferred iPad gate:

- RB-106 completed protected API JSON error contract coverage.
- RB-107 completed safe append-only version allocation via PostgreSQL advisory locks.
- RB-109 completed DB constraints for review/export integrity.
- RB-111 added high-cost rate limits and export caps.
- RB-112 changed export creation from synchronous ZIP generation to async `ExportBatch` jobs with states such as `PENDING`, `PROCESSING`, `COMPLETED`, and `FAILED`.

Therefore, the iPad gate must validate not only editor interaction and save/reload behavior, but also that the new async export UX is understandable and functional on Mobile Safari.

This ticket is a manual validation gate, not a feature implementation ticket.

## Goal

Execute and document a real physical iPad Safari customer-trial gate against the current post-RB-112 app baseline.

The goal is to produce credible evidence for whether the app is ready for controlled iPad/tablet trial use, and to convert every observed issue into focused follow-up tickets.

## Non-Goals

- Do not mark this ticket complete from Playwright, Chromium emulation, or screenshots alone.
- Do not implement broad fixes in this ticket.
- Do not expand official browser/device support beyond what is actually tested.
- Do not bypass RB-111 rate limits or export caps just to make the manual test pass.
- Do not change async export architecture from RB-112.
- Do not use production/customer data unless explicitly approved for trial validation.

Tiny documentation corrections are acceptable if they directly record the gate result.

## Required Test Evidence

Record the following in a new manual evidence document, for example:

`docs/07-testing/manual-smoke-ipad-safari-gate-YYYY-MM-DD.md`

Minimum evidence fields:

- Date and tester.
- App commit SHA under test.
- Deployment URL.
- Whether the deployment is local tunnel, staging, or customer-trial host.
- User/account used, without recording secrets.
- iPad model.
- iPadOS version.
- Safari version if available.
- Apple Pencil model or note that no Pencil was used.
- Network context, for example Wi-Fi/internal/VPN.
- Test dataset/project identifier.
- Whether export worker/processor was running automatically or triggered manually.
- Pass/fail summary.
- Follow-up ticket list for every failure or serious usability issue.

## Manual Test Scope

Use the existing iPad smoke checklist as the starting point:

- `docs/07-testing/manual-smoke-ipad-safari-gate.md`

Update the checklist only if it is stale after RB-111/RB-112.

### A. Login, Session, And Navigation

Validate on real iPad Safari:

- Login works with the named test account.
- Session survives normal navigation and reloads.
- Logout or stale-session behavior is understandable and does not show raw framework errors.
- Project list and project detail navigation are usable with touch.
- Core workflow pages do not require desktop-only hover behavior.

### B. Image Upload And Project Workspace

Validate:

- Image upload works from iPad Safari for the selected trial image source.
- Upload failures, if any, produce stable user-facing errors.
- Metadata/readiness panels remain usable on the iPad viewport.
- RB-111 high-cost limits do not interfere with normal single-user trial usage.
- If a rate limit is intentionally triggered, the UI handles `429 RATE_LIMITED` gracefully and displays retry guidance instead of crashing.

### C. Crop / Slice Workflow

Validate the current post-RB-108 route/workflow, not the removed legacy `/edit` route:

- Crop workflow entry from the current project/image route.
- BBox stage.
- Slice navigator.
- Selected crop workbench.
- Crop support editor.
- Crop semantic editor.
- Assisted correction entry/visibility where applicable.
- Save and reload behavior after support/semantic edits.
- Switching between crops/slices without losing state.
- Rotation between portrait and landscape.

### D. Drawing, Touch, And Apple Pencil Behavior

Validate, with Apple Pencil if available:

- Drawing starts only when intended.
- Finger/touch scrolling and tool interaction do not accidentally draw.
- Brush/eraser/tool controls are usable.
- Undo/redo or equivalent correction controls behave as expected.
- Zoom/pan behavior remains usable.
- Canvas alignment remains correct after zoom, pan, save/reload, and rotation.
- No obvious Safari memory crash occurs on the selected trial-size images.

If no Apple Pencil is available, record the limitation clearly and create a follow-up gate/ticket for Pencil-specific validation.

### E. Review Controls And Ground-Truth State

Validate:

- Review/approval controls are visible and usable.
- Review decisions persist across reloads.
- Rejected/approved state is displayed consistently.
- Crop/training export eligibility reflects the expected reviewed/approved state.
- No stale route or legacy full-image `/edit` link is exposed to the user.

### F. Async Export UX After RB-112

Validate the new async export flow on iPad Safari:

- Training export creation returns quickly and does not block the browser while ZIP generation runs.
- Crop-training export creation follows the async job path.
- Prediction-analysis export creation follows the async job path if test data exists.
- UI shows a queued/processing state instead of presenting an immediate download too early.
- UI polls or refreshes status reliably.
- Download link appears only after `COMPLETED`.
- Completed export can be downloaded from iPad Safari.
- Failed export, if intentionally triggered with a safe fixture or operator action, presents a stable user-facing error and does not expose stack traces or secrets.
- Export cap violations from RB-111, if intentionally tested, produce stable cap/rate-limit messaging.

### G. Home Screen / PWA-Like Behavior

If relevant for the customer trial:

- Add to Home Screen.
- Open from Home Screen.
- Login/session behavior.
- Navigation and editor usability.
- Export status/download behavior.

If Home Screen behavior is not part of the trial claim, record it as not tested and do not claim support.

## Follow-Up Ticket Rules

Every failure must become one of:

- A focused bug ticket with reproduction steps.
- A docs-only correction if the app behavior is acceptable but the documentation/support claim is wrong.
- A deferred known gap if the behavior is outside the current trial scope.

Each follow-up ticket must include:

- Device and iPadOS/Safari version.
- Exact page/route.
- Reproduction steps.
- Expected behavior.
- Actual behavior.
- Screenshot or screen recording reference if available.
- Severity recommendation.

Do not batch unrelated iPad issues into a broad “fix iPad” ticket unless they share the same root cause.

## Acceptance Criteria

- A real physical iPad Safari evidence document exists.
- The evidence clearly states pass, fail, or conditional pass.
- The test includes the post-RB-112 async export status/download flow.
- The test includes crop/slice editing, save/reload, and review controls.
- Apple Pencil behavior is validated or explicitly marked as not validated with follow-up.
- Every failure or serious usability issue has a focused follow-up ticket.
- Customer-trial readiness docs are updated with the actual gate result.
- No unsupported tablet/browser support claim remains in docs.

## Validation

Run before or during the manual gate:

```bash
git status --short
npm run test:e2e:ipad-prep
npm run test:e2e
npm run handoff:archive -- --dry-run
```

If the deployed environment differs from local test setup, also record:

```bash
npm run exports:process -- --help
```

or the equivalent operator command used to process queued exports.

Manual validation must be recorded. Automated validation alone is insufficient.

## Completion Protocol

When complete:

1. Add the manual evidence document.
2. Update testing/customer-trial readiness docs with pass/fail status.
3. Create follow-up tickets for all issues.
4. Move this optimized ticket to the appropriate `done/` folder only after real iPad evidence exists.
5. Commit the evidence/docs/ticket updates.

## Notes For Codex

- Treat this as a manual gate orchestration/documentation ticket.
- Do not simulate iPad Safari and call the ticket complete.
- Do not rewrite the editor as part of this ticket.
- Do not change RB-111 rate-limit defaults or RB-112 async export architecture unless a tiny docs correction is needed.
- Keep any implementation follow-up separate and focused.
