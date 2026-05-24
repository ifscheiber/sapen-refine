# RB-120-A - Editor Save Orchestration Extraction

## Status

Planned / Opportunistic

## Priority

P3 unless an editor save/reload bug or feature makes it blocking

## Type

Maintainability / Editor / Refactor

## Source

- `docs/01-architecture/opportunistic-decomposition-map.md`
- RB-120 follow-up

## Activation Condition

Activate only when a scheduled feature or bug fix already touches editor save, reload, dirty-state, or stable save error handling.

## Goal

Extract behavior-preserving editor save orchestration from the large editor client surface into a narrow helper or hook.

## Requirements

- Preserve current semantic/support/correction save APIs and headers.
- Preserve dirty revision, queued save, stale response, and reload-after-save behavior.
- Keep canvas drawing, pointer interaction, and review UI layout outside this extraction.
- Add or preserve focused tests before moving behavior.

## Validation

- `npm run typecheck`
- `npm run test -- tests/unit/editor-helpers.test.ts tests/unit/mask-upload-route-contracts.test.ts`
- Focused E2E if user-visible save behavior changes.
