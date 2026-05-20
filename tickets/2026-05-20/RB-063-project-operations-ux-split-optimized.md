# RB-063 - Project Operations UX Split

## Status

In Progress

## Priority

High

## Type

UX / Routing / Project Operations / iPad Readiness / Tests / Docs

## Repository

`sapen-annotate`

## Depends on

- RB-062 - Repository State & Documentation Consistency Sweep

## Blocks

- RB-069 - Customer Trial Deployment, Handoff Hygiene & iPad Safari Gate
- Future customer-facing trial usability
- Future project operations growth

---

## 1. Context

RB-062 aligned the repository docs after the RB-040–RB-061 feature chain.

The current project overview has become operationally dense. The RB-063 draft correctly identifies the problem:

- `/app/projects/[projectId]` composes project metadata, image/task navigation, prediction batch import operations, training export, and prediction-analysis export controls.
- Operations-heavy panels make the overview harder to scan and will become brittle as customer-trial workflows grow.
- The target direction is to keep `/app/projects/[projectId]` focused on project status/readiness and links to primary actions, while moving export and prediction-import workflows into dedicated route-addressable operations areas. fileciteturn16file0

This ticket must improve navigation and layout without changing domain behavior.

---

## 2. Goal

Split project operations into clear, route-addressable pages while keeping the project overview readable and iPad-friendly.

At the end of RB-063:

1. Project Overview is a concise status/action hub.
2. Heavy operations are moved to dedicated project subroutes.
3. Export workflows remain fully functional.
4. Prediction import/batch workflows remain fully functional.
5. Correction tasks remain reachable by their existing route.
6. Browser back/forward/deep links work.
7. Existing API/domain behavior and role checks remain unchanged.
8. Desktop and iPad-sized layouts are easier to scan.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- Prisma schema changes,
- API/domain behavior changes,
- export logic changes,
- prediction-import logic changes,
- batch-processing logic changes,
- task queue logic changes,
- auth/RBAC hardening beyond preserving existing behavior,
- new product workflows,
- visual redesign unrelated to operations split,
- editor decomposition.

If a behavior bug is discovered, document it unless it blocks the split.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Start with:

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

Work in focused slices and commit after each meaningful slice.

---

## 5. Target Route Structure

Codex should inspect the existing App Router structure before choosing exact paths. The target should be close to:

```text
/app/projects/[projectId]                      # overview/status/action hub
/app/projects/[projectId]/images               # existing image workflow
/app/projects/[projectId]/tasks                # existing correction task queue
/app/projects/[projectId]/exports              # training export + prediction-analysis export
/app/projects/[projectId]/prediction-imports   # prediction runs + batch imports
```

If existing route names differ, preserve working routes and add redirects/links only if safe.

Hard rules:

- Operations routes must be URL-addressable.
- Do not hide operations behind local-only tabs without stable URLs.
- Breadcrumbs/back navigation should make sense.
- Project Overview should link to these areas with clear action cards.

---

## 6. Project Overview Scope

`/app/projects/[projectId]` should become a project status hub.

Keep or add compact summaries:

- project name/description/edit affordance,
- label schema / setup status,
- image count / metadata readiness summary,
- annotation/review/export readiness summary,
- correction task count summary,
- prediction/batch import summary,
- primary action links:
  - Manage Images,
  - Correction Tasks,
  - Exports,
  - Prediction Imports,
  - Metadata/Settings if already present.

Remove or collapse heavy panels:

- full training export panel,
- full prediction-analysis export panel,
- full batch import panel,
- long operation forms.

The overview should remain useful but not become an operations console.

---

## 7. Operations Routes

### 7.1 Project exports route

Create or refine:

```text
/app/projects/[projectId]/exports
```

This route should contain:

- ground-truth training export panel,
- prediction-analysis export panel,
- export readiness summaries,
- export history/download links if already available,
- clear warning that prediction-analysis export is not ground truth,
- role-aware controls.

Reuse existing components where possible:

```text
src/features/projects/ProjectExportPanel.tsx
```

Do not duplicate export logic.

If `ProjectExportPanel` currently mixes both export modes, either keep it and mount it only on the exports page, or split it into smaller components:

```text
TrainingExportPanel
PredictionAnalysisExportPanel
ProjectExportSummary
```

Only split if it materially improves clarity without large refactor.

### 7.2 Prediction imports route

Create or refine:

```text
/app/projects/[projectId]/prediction-imports
```

This route should contain:

- prediction run summary/list if available,
- single prediction import entry points if currently surfaced,
- batch prediction import panel,
- batch status/history,
- process/retry controls for authorized roles,
- operational warnings/limits.

Reuse existing components where possible:

```text
ProjectPredictionImportBatchPanel
```

Do not change batch processing semantics.

### 7.3 Task route integration

The existing correction task route should remain:

```text
/app/projects/[projectId]/tasks
```

Project Overview should link to it.

Do not move or redesign the task queue unless required for navigation consistency.

### 7.4 Images route integration

Existing image routes should remain stable.

Project Overview should link to:

```text
/app/projects/[projectId]/images
```

Do not change image/editor behavior.

---

## 8. Shared Project Operations Navigation

Add or refine a reusable project navigation component if useful.

Possible component:

```text
src/components/shell/ProjectSubnav.tsx
```

or feature-scoped:

```text
src/features/projects/ProjectOperationsNav.tsx
```

It should provide links such as:

```text
Overview
Images
Tasks
Exports
Prediction Imports
```

Rules:

- Use existing App Shell/design tokens.
- Keep it responsive.
- Avoid hover-only controls.
- Keep touch targets reasonable for iPad.
- Avoid hardcoded colors/styles.

If project navigation already exists, extend it rather than duplicating.

---

## 9. iPad / Responsive Requirements

RB-063 is partly an iPad-readiness ticket.

Requirements:

- project overview should not require excessive vertical scrolling through dense forms,
- operations cards should wrap cleanly at iPad widths,
- export/import forms should be on their own pages with sufficient space,
- no table-only layout that overflows without fallback,
- controls should be touch-friendly,
- no hover-only affordances.

Real iPad Safari smoke remains deferred to RB-069/customer deployment gate, but layout should be prepared.

---

## 10. Authorization / Security

Do not change domain rules, but preserve all existing authorization behavior.

Rules:

- Owner/QA-only export/import controls remain protected server-side.
- UI may hide controls, but API must remain source of truth.
- Do not add new API endpoints just to bypass existing role checks.
- No private storage keys/URLs leak due to route/component refactor.

If scattered RBAC makes this hard, document for RB-064 rather than refactoring broadly here.

---

## 11. Tests

### 11.1 Unit/component tests

Add only if existing test style supports it.

Useful candidates:

- project operation route-link helper,
- navigation item config,
- summary card data mapping.

Do not add brittle visual snapshot tests.

### 11.2 Integration/API tests

No new API behavior expected.

Only add/update if route refactor requires changed server loaders.

### 11.3 E2E tests

Update Playwright smoke as needed.

Must still cover or preserve access to:

- project overview,
- image upload/editor path,
- correction tasks route,
- training export route/workflow,
- prediction-analysis export route/workflow,
- prediction import/batch route or entry point.

If the existing E2E currently uses project overview selectors for export/import, update it to use the new operations routes.

Existing E2E must remain green.

---

## 12. Documentation Updates

Update:

```text
docs/03-features/projects.md
docs/03-features/images.md
docs/03-features/editor.md
docs/06-data/training-export-contract.md
docs/06-data/prediction-analysis-export-contract.md
docs/06-data/model-prediction-contract.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/00-overview/current-state.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must explain:

- new project route structure,
- where exports live,
- where prediction imports/batches live,
- overview is now a status/action hub,
- no behavior/API semantics changed,
- iPad layout is improved structurally but real Safari smoke remains deferred.

---

## 13. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. `/app/projects/[projectId]` is visibly lighter and focused on overview/status/actions.
3. Export workflows are reachable through a stable project exports URL.
4. Prediction import/batch workflows are reachable through a stable project prediction-imports URL.
5. Existing tasks and image/editor routes remain reachable.
6. Project navigation/deep links/back navigation are coherent.
7. Existing export/import/task domain behavior is unchanged.
8. Existing role/permission behavior is preserved.
9. Desktop E2E passes after route updates.
10. Layout remains responsive at iPad-sized widths.
11. Docs and smoke checklists are updated.
12. Ticket is moved to:

```text
tickets/2026-05-20/done/
```

13. Final validation passes:

```bash
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
```

14. Final Codex report includes:
    - commits created,
    - routes/components changed,
    - tests updated,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 14. Suggested Commit Sequence

```bash
git commit -m "docs: define project operations route split"
git commit -m "refactor: add project operations navigation"
git commit -m "refactor: move export workflows to project exports route"
git commit -m "refactor: move prediction imports to project operations route"
git commit -m "test: update browser smoke for project operations routes"
git commit -m "docs: document project operations ux split"
git commit -m "chore: finalize project operations split ticket"
```

---

## 15. Notes for Codex

- This is routing/UX organization, not domain behavior.
- Reuse existing panels and services.
- Prefer route-addressable pages over dense overview panels.
- Keep overview useful, but not an operations console.
- Preserve all validation gates.
