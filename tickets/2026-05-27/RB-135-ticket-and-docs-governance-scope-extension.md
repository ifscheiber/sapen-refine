# RB-135 - Ticket And Docs Governance Scope Extension

Status: Planned
Priority: P2
Type: Documentation governance / regression guard

## Context

RB-119 added [../../tests/unit/docs-link-governance.test.ts](../../tests/unit/docs-link-governance.test.ts), which scans:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `docs/**/*.md`
- `tickets/2026-05-23/README.md`

The repository now has additional active sprint folders after `tickets/2026-05-23`, including design, performance, export, and this production-readiness sprint. New active sprint README files and review reports can accumulate broken local links without being covered by the governance test.

## Impact

The docs-link guard can stay green while newer active ticket indexes drift. That weakens the ticket system as a production planning record, especially when tickets link to implementation evidence and deferred gates.

## Goal

Extend link/index governance to current active ticket sprints without making historical completed tickets brittle.

## Non-Goals

- Do not require every historical `done/` ticket to pass new link rules unless the repo intentionally opts in.
- Do not rewrite completed ticket history.
- Do not fail on external links or markdown anchors that cannot be reliably checked locally.

## Implementation Plan

1. Decide the governed ticket scope, for example all active `tickets/*/README.md` plus explicitly active optimized tickets, while excluding `done/` and archived historical evidence unless deliberately included.
2. Update `tests/unit/docs-link-governance.test.ts` to discover governed active ticket README files dynamically.
3. Add this sprint README to the governed set.
4. Keep the existing false-positive protection around the rejected `docs/README.md` broken-link claim.
5. Document the scope in [../../docs/testing/README.md](../../docs/testing/README.md) or a nearby governance doc.

## Files to Inspect

- `tests/unit/docs-link-governance.test.ts`
- `docs/testing/README.md`
- `tickets/2026-05-23/README.md`
- `tickets/2026-05-27/README.md`
- `tickets/design/00-sprint-index.md`
- `tickets/performance`

## Acceptance Criteria

- Active sprint README local links are checked by `npm run check:docs-links`.
- Historical `done/` tickets are not made noisy by default.
- The test failure output identifies the source file and resolved missing target.
- Validation includes `npm run check:docs-links`, `npm run test -- tests/unit/docs-link-governance.test.ts` if supported by the script setup, and `git diff --check`.

## Validation Commands

```bash
npm run check:docs-links
npm run test -- tests/unit/docs-link-governance.test.ts
git diff --check
```
