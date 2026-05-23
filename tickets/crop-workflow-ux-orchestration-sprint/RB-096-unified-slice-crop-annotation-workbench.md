# RB-096 — Unified Slice Crop Annotation Workbench

## Status

Proposed / Depends on RB-095

## Priority

High

## Type

UX / Editor Orchestration / Crop Workbench / Tests

## Goal

Provide a unified crop workbench for a selected slice, with support and semantic steps organized as a guided workflow.

## Desired User Flow

```text
Select slice in navigator
→ crop workbench opens
→ Step A: draw/verify support mask
→ Step B: semantic annotation unlocks when support exists
→ Step C: classification shown/derived
```

## Scope

- Create or refine unified crop workbench route.
- Show selected slice crop.
- Show support mask step.
- Show semantic mask step.
- Show classification/readiness summary.
- Link to existing support editor and semantic editor, or embed them if safe.
- Keep whole-image navigator accessible.

## Non-Goals

- Do not change mask semantics.
- Do not redesign support/semantic APIs.
- Do not implement export changes.
- Do not build full review dashboard.

## Tests

- Workbench opens for selected slice.
- If support missing, semantic step is locked.
- If support exists, semantic step is available.
- Workbench shows classification status.
- Existing support/semantic editors remain functional.

## Acceptance Criteria

1. Unified crop workbench exists.
2. Workflow steps are clear.
3. Semantic editing is not presented before support exists.
4. Whole-image context/navigation remains accessible.
5. Existing crop support/semantic behavior remains green.
6. Docs and smoke tests updated.
7. Full validation passes.
