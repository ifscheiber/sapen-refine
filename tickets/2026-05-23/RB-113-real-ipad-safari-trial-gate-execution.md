# RB-113 - Real iPad Safari Trial Gate Execution

## Status

Planned / Manual Gate

## Priority

P2

## Type

iPad Validation / Customer Trial Gate / Manual Evidence

## Source

- `tickets/deferred/RB-077-B-real-ipad-safari-trial-gate-execution.md`
- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`

## Depends On

- Deployed HTTPS trial URL.
- Named test account.
- Physical iPad with Safari access.
- Optional Apple Pencil for drawing validation.

## Blocks

- Production support claim for iPad/tablet annotation.

## Context

Automated desktop and iPad-sized viewport tests exist, but they do not validate real Safari, Apple Pencil behavior, mobile memory behavior, file upload, rotation, or Home Screen mode. The existing deferred ticket remains the source of truth for the manual gate trigger.

## Goal

Execute the real iPad Safari customer trial gate and record evidence.

## Non-Goals

- Do not mark this complete without real physical-device evidence.
- Do not implement fixes in this ticket unless they are tiny documentation corrections.
- Do not broaden support claims to unsupported browsers.

## Requirements

- Use `docs/07-testing/manual-smoke-ipad-safari-gate.md`.
- Record device model, iPadOS version, Safari version, deployment URL, account used, date, and tester.
- Verify login, project navigation, image upload, metadata, crop workflow entry, BBox stage, crop workbench, support editing, semantic editing, save/reload, review controls, export visibility, rotation, and Home Screen behavior where applicable.
- Capture failures as separate focused tickets.
- Update customer-trial readiness docs with the actual gate result.

## Acceptance Criteria

- Manual gate evidence is documented.
- Pass/fail status is clear.
- Every failure has a reproducible note and follow-up ticket.
- Existing `npm run test:e2e:ipad-prep` remains green.

## Validation

Run:

```bash
git status --short
npm run test:e2e:ipad-prep
```

Manual validation must also be recorded. Automated validation alone is insufficient.
