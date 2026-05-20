# RB-068 - Editor Decomposition

## Status

Proposed / Ready for Codex

## Priority

Medium

## Type

Editor / Refactor / Maintainability / iPad Readiness / Tests

## Depends on

- RB-062 - Repository State and Documentation Consistency Sweep

## Goal

Decompose the large editor client incrementally while preserving behavior.

Current issue:

- `src/features/editor/EditorClient.tsx` owns drawing tools, semantic/support modes, review controls, slice classification, assisted correction, save state, overlays, task context, and viewport behavior.
- The editor works, but future changes will be risky if every feature continues to land in one large component.

## Non-Goals

- Do not rewrite the editor from scratch.
- Do not change mask serialization format.
- Do not change review/export semantics.
- Do not add new annotation tools unless required to preserve existing behavior.
- Do not perform unrelated visual redesign.

## Required Baseline

Run before editing:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
```

## Implementation Notes

- Split one concern at a time.
- Candidate extraction order:
  - editor state/hooks,
  - canvas rendering/layers,
  - toolbar/tool controls,
  - review/status controls,
  - correction task context,
  - save/commit service wrapper.
- Keep URL routes and API contracts unchanged.
- Maintain desktop browser and iPad viewport preparation coverage.
- Add unit coverage for extracted pure helpers where practical.

## Acceptance Criteria

- `EditorClient.tsx` is materially smaller without behavior regression.
- Existing desktop E2E still passes.
- Extracted pieces have clear names and ownership.
- Editor/docs/test index are updated.
- Ticket is moved to `tickets/2026-05-20/done/` after completion.

