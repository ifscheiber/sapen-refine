# Hotfix Sprint — Crop Editor UX and Support Policy Fixes

## Status

Proposed / Ready for Codex

## Trigger

Following RB-093 and RB-094, review and smoke testing showed that the technical crop workflow exists, but the user-facing workflow and support policy need correction.

## Problem Summary

Four issues need to be fixed before continuing the crop workflow sprint:

1. The crop semantic editor can reload/refetch repeatedly because data-fetch effects are coupled to state-derived render callbacks.
2. Support masks are too strictly required for all semantic modes. Sap/Heartwood should be allowed without explicit support; Copper needs explicit support only for readiness/export.
3. The slice navigator should be embedded directly in support and semantic editors as a right-side navigation/context panel.
4. Crop editors need the full mask editing palette: brush, eraser, lasso, polygon lasso, undo/redo, opacity and label selection.

## Final Policy

### Sap/Heartwood

```text
Support mask not required for semantic draft, review, readiness, or export.
Semantic foreground defines derived support geometry.
Crop padding is never support unless semantically labelled as foreground.
```

### Copper

```text
Support mask not required for draft semantic save.
Support mask required for readiness/export.
Copper semantic mask is never support geometry.
```

## Ticket Sequence

```text
RB-099  Crop Semantic Editor Reload Stability Hotfix
RB-100  Mode-Aware Support Policy for Crop Semantics
RB-101  Embedded Slice Navigator and Ensure Current Crops
RB-102  Full Crop Mask Tool Palette and Shared Mask Operations
```

## Recommended Order

1. RB-099 — stabilize editor loading first.
2. RB-100 — fix domain/readiness/export support policy.
3. RB-101 — integrate navigator into crop editors.
4. RB-102 — add full tool palette once workflow is stable.

## Validation Baseline

Each implementation ticket should run:

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
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```
