# RB-112 - Async And Streaming Export Job Hardening

## Status

Planned

## Priority

P2

## Type

Exports / Background Jobs / Operations / Scale Hardening

## Source

- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`

## Depends On

- RB-105 export-time checksum verification should be included first or as the first slice of this work.
- RB-111 should define high-cost creation caps if this ticket remains route-triggered.

## Blocks

- Production-scale training exports and prediction-analysis exports.

## Context

Training and prediction-analysis export code uses JSZip and `getObjectBytes(...)`, building packages in the app/server process. This is acceptable for trial-sized datasets but can exhaust memory or hit request/proxy timeouts for larger projects.

## Goal

Move export generation toward a production-safe job/streaming model, or at minimum enforce explicit trial caps until that model is implemented.

## Non-Goals

- Do not change what qualifies as exportable ground truth.
- Do not expose private storage keys.
- Do not change manifest format unless a versioned change is required.
- Do not build a general queue platform beyond export needs unless reused from existing batch job patterns.

## Requirements

- Add explicit export item-count and byte-budget caps if background jobs are not implemented immediately.
- Define export job states, retry behavior, generated artifact references, and user-visible status.
- Reuse existing single-host job/lease patterns where reasonable.
- Replace or isolate synchronous JSZip memory-heavy generation for large exports.
- Preserve manifest reproducibility and checksum semantics.
- Add operator documentation for large export handling.

## Acceptance Criteria

- Large export requests cannot exhaust app memory through unbounded synchronous ZIP generation.
- Trial cap violations return stable API errors.
- Export packages still include the same approved artifacts and provenance.
- Tests cover cap rejection and successful export creation.
- If async jobs are implemented, tests cover job creation, processing, failure, retry, and download after completion.

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
