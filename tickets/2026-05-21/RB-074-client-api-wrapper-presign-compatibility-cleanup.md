# RB-074 - Client API Wrapper / Presign Compatibility Cleanup

## Status

Proposed / Ready for Planning

## Priority

Medium

## Type

Client API / Storage Contract / Repository Hygiene

## Context

The deep review found that `src/lib` still contains stale browser-side API wrappers for older presign/commit paths and fields such as `storageKey`, while the current trial browser workflows use app-mediated upload/read routes.

Keeping unused wrappers increases the risk that future UI work accidentally reintroduces direct-storage assumptions.

## Goal

Align client API helpers and docs with the current app-mediated browser storage contract.

## Requirements

- Audit `src/lib` usages and remove, replace, or document unused wrappers.
- Keep backend validation and authorization as the source of truth.
- Decide whether compatibility presign routes remain internal/admin-only, stay as legacy compatibility routes, or are deprecated.
- Update `docs/src/lib/README.md` and API/storage docs accordingly.
- Add tests only if wrapper behavior remains part of the supported client contract.

## Non-Goals

- Do not redesign upload/storage architecture.
- Do not remove compatibility API routes unless explicitly covered by the implementation plan.
- Do not change mask or image storage formats.

## Acceptance Criteria

- `src/lib` no longer advertises stale browser contracts.
- Current browser-side upload/read helpers match app-mediated routes.
- Presign compatibility policy is explicit in docs.
- Validation remains green.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`

