# RB-111 - High-Cost Write Rate Limits And Trial Caps

## Status

Planned

## Priority

P2

## Type

Security / Operations / API Hardening / Upload And Export Limits

## Source

- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- `docs/known-gaps.md`

## Depends On

- RB-106 API error contract completion is preferred first so rate-limit responses use the stable API convention.

## Blocks

- Production exposure of high-cost authenticated write endpoints.

## Context

Login throttling and same-origin mutation protection exist, but broad authenticated write rate limiting does not. Upload, export, prediction import, batch process, and cleanup endpoints can consume significant CPU, memory, DB, and object-storage resources.

The reports also note that current upload/export defaults are trial-sized and should remain explicit.

## Goal

Add explicit high-cost endpoint limits and stable rate-limit behavior for trial-to-production hardening.

## Non-Goals

- Do not introduce a full multi-tenant billing/quota system.
- Do not move exports to background jobs in this ticket; see RB-112.
- Do not weaken existing login throttling.

## Requirements

- Identify high-cost write endpoints: image upload, mask/support/crop saves, export creation, prediction-analysis export creation, prediction batch upload/process/retry, and storage cleanup.
- Define per-user and/or per-project rate-limit keys.
- Return stable JSON errors with a clear rate-limit code and status.
- Keep default limits suitable for single-host customer trial.
- Add explicit item/byte caps where missing, especially export creation and batch processing.
- Document env/config defaults and operator tuning.
- Add tests for limit exceeded, reset behavior, and unaffected normal requests.

## Acceptance Criteria

- High-cost routes reject excessive repeated requests with stable JSON.
- Trial caps are documented and configurable where practical.
- Normal happy-path upload/save/export tests remain green.
- Rate-limit hits are logged or audited where useful for operations.

## Validation

Run:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
```
