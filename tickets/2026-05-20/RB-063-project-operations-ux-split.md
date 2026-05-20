# RB-063 - Project Operations UX Split

## Status

Proposed / Ready for Codex

## Priority

High

## Type

UX / Routing / Project Operations / iPad Readiness / Tests

## Depends on

- RB-062 - Repository State and Documentation Consistency Sweep

## Goal

Split the increasingly dense project overview into route-addressable operations areas that remain usable on desktop and smaller iPad screens.

Current issue:

- `/app/projects/[projectId]` composes project metadata, image/task navigation, prediction batch import operations, training export, and prediction-analysis export controls.
- Operations-heavy panels make the overview harder to scan and will become brittle as customer trial workflows grow.

Target direction:

- Keep `/app/projects/[projectId]` focused on project status, readiness, and links to primary actions.
- Add dedicated project operations routes for export and prediction-import workflows.
- Preserve existing API contracts and project membership behavior.
- Keep routes URL-first and responsive for desktop and iPad-sized screens.

## Non-Goals

- Do not change Prisma schema.
- Do not change export, prediction-import, or task queue domain behavior.
- Do not add new product modes.
- Do not remove existing APIs.
- Do not implement auth/RBAC hardening beyond preserving existing checks.

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

- Inspect existing project routes and components before adding routes.
- Prefer reusing `ProjectExportPanel` and `ProjectPredictionImportBatchPanel` rather than duplicating logic.
- Add route-level pages only where they materially reduce overview density.
- Update navigation and breadcrumbs/links so browser back/forward and deep links work.
- Ensure owner/QA-only controls remain server/API guarded, not only hidden in UI.
- Preserve the desktop golden path and keep iPad viewport layout from overflowing.

## Acceptance Criteria

- Project overview is visibly lighter and links to operations areas.
- Export and prediction-import workflows are reachable by stable URLs.
- Existing E2E happy paths still pass.
- Docs for routes/features/testing are updated.
- Ticket is moved to `tickets/2026-05-20/done/` after completion.

