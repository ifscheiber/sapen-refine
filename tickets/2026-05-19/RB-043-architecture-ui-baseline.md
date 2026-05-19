# RB-043 — Architecture & UI Baseline Before Domain Expansion

## Status

Proposed / Ready for Codex

## Context

SaPen Annotate is being restarted from an early development/prototype state. There is no production data and no backwards-compatibility obligation for existing local development records. This is the right moment to establish a clean technical baseline before adding the real annotation domain model, export logic, model-assisted preprediction, or Core handoff features.

The current codebase already contains useful early pieces: Next App Router routes, authentication, projects, image upload, mask editing, shadcn-style UI primitives, and theme CSS. However, the app structure is still prototype-like: routes and UI responsibilities are mixed, editor implementations overlap, design values are not consistently governed by a design system, and documentation is not yet structured as a system of record.

This ticket creates the **architecture and UI foundation** for future work.

## Goal

Codex shall first review the existing repository architecture, document the current state, then refactor the app into a modular, reusable, design-token-driven baseline.

The goal is not to implement the future annotation domain yet. The goal is to make sure all later feature work has a stable foundation:

- thin route files,
- reusable App Shell,
- feature modules,
- documented architecture,
- centralized design tokens,
- reusable components,
- light/dark mode readiness,
- green baseline checks/tests from RB-041,
- focused commits after each meaningful slice.

## Non-Goals

Do **not** implement the future annotation domain model in this ticket.

Out of scope:

- full T-number/specimen/slice/acquisition metadata schema redesign,
- training export implementation,
- admin download/export UI,
- model preprediction or active-learning ranking,
- Core handoff integration,
- mask format migration beyond hygiene required by this architecture baseline,
- full editor rewrite,
- advanced role/permission redesign.

Because no production data exists, Codex may simplify or reset development-only artifacts if this removes harmful prototype debt. However, domain expansion must remain deferred.

## Required Working Mode

Follow `AGENTS.md`.

Mandatory process:

1. Start with `git status --short`.
2. Restore/install dependencies as needed.
3. Generate Prisma client if needed.
4. Run baseline checks before changing production code where practical.
5. Record current baseline failures instead of hiding them.
6. Work in meaningful slices.
7. At the end of each slice:
   - run relevant checks,
   - update docs,
   - create a detailed focused Git commit.
8. Do not mix unrelated completed slices in one commit.

## External Architecture References

Use current official documentation as guidance, not as a rigid template:

- Next.js App Router project structure and route groups.
- Tailwind CSS v4 theme variables and runtime CSS-variable tokens.
- shadcn/ui CSS-variable theming conventions.

The repo should remain simple and appropriate for SaPen Annotate; do not over-engineer.

---

# Implementation Plan

## Slice 1 — Baseline Review and Evidence Capture

### Tasks

- Inspect the current repository structure.
- Identify route groups, pages, API routes, server modules, mask modules, components, styles, Prisma schema, and scripts.
- Run/check as much of the baseline as possible:
  - `npm install` or `npm ci`, depending on lockfile state,
  - `npx prisma generate --schema=prisma/schema.prisma`,
  - `npm run lint`,
  - `npm run build` if feasible,
  - any existing tests if present.
- Create a concise baseline report.

### Required docs

Create or update:

- `docs/README.md`
- `docs/00-overview/current-state.md`
- `docs/00-overview/baseline-checks.md`

`baseline-checks.md` must include:

- command run,
- result,
- failure summary if any,
- whether the failure pre-existed before this ticket’s implementation changes.

### Acceptance Criteria

- Baseline state is documented before refactor changes.
- Existing failures are clearly separated from changes introduced by this ticket.
- First focused commit exists, for example:
  - `docs: record initial architecture baseline`

---

## Slice 2 — Documentation Skeleton Mirroring the Repo

### Goal

Create a lightweight but navigable `docs/` structure that mirrors the repository and becomes the system of record for future Codex work.

### Required docs structure

Create at minimum:

```text

docs/
  README.md
  00-overview/
    current-state.md
    baseline-checks.md
    product-boundaries.md
  01-architecture/
    app-router.md
    module-boundaries.md
    app-shell.md
    design-system.md
  02-app/
    routes.md
    api-routes.md
  03-features/
    README.md
    auth.md
    projects.md
    images.md
    editor.md
  04-server/
    auth.md
    db.md
    storage.md
  05-design-system/
    tokens.md
    components.md
    theming.md
  06-data/
    prisma.md
    mask-format.md
  07-testing/
    quality-gates.md
  08-adr/
    README.md
    ADR-001-architecture-ui-baseline.md
    remediation-backlog.md
```

The docs may be concise, but they must contain real file references and must not invent implemented behavior.

### Acceptance Criteria

- `docs/README.md` acts as a navigation index.
- Each doc references actual source paths where possible.
- Unknown/future behavior is marked as planned or deferred.
- `ARCHITECTURE.md` points to the docs tree as the detailed source of record.
- Focused commit exists, for example:
  - `docs: add architecture documentation skeleton`

---

## Slice 3 — App Router and Module Boundary Baseline

### Goal

Make route files thin and establish clear reusable feature/module boundaries.

### Target structure

Codex may adapt exact names, but the final structure should clearly separate routes, feature logic, shell, design, and server code.

Recommended structure:

```text
src/
  app/
    (public)/
      login/
        page.tsx
    (workspace)/
      app/
        layout.tsx
        page.tsx
        projects/
          page.tsx
          new/
            page.tsx
          [projectId]/
            page.tsx
            images/
              page.tsx
              [imageId]/
                edit/
                  page.tsx
    api/
      ...
  components/
    shell/
    ui/
  design/
    tokens.css
    themes.css
  features/
    auth/
    dashboard/
    projects/
    images/
    editor/
  server/
    auth/
    db.ts
    storage/
  mask/
  lib/
```

Rules:

- `src/app/**/page.tsx` and `src/app/**/layout.tsx` should be thin route composition files.
- App-specific UI belongs in `src/features/**` or `src/components/shell/**`.
- Generic reusable primitives stay in `src/components/ui/**`.
- Server-only helpers remain under `src/server/**`.
- Avoid duplicating project/image/editor UI across routes.
- Keep URLs stable unless there is a documented reason to change them.

### Acceptance Criteria

- Routes are organized clearly, preferably using route groups where useful.
- Route components are thin.
- Feature modules have obvious ownership.
- No second parallel App Shell remains active.
- Docs updated:
  - `docs/01-architecture/app-router.md`
  - `docs/01-architecture/module-boundaries.md`
  - `docs/02-app/routes.md`
- Focused commit exists, for example:
  - `refactor: establish app router and feature module baseline`

---

## Slice 4 — Reusable App Shell Baseline

### Goal

Create a reasonable, reusable authenticated App Shell so future pages do not redesign layout repeatedly.

### Required shell elements

Implement or consolidate reusable shell components, for example:

```text
src/components/shell/
  AppShell.tsx
  AppSidebar.tsx
  AppTopbar.tsx
  AppBreadcrumbs.tsx
  AppPageHeader.tsx
  AppMain.tsx
  AppEmptyState.tsx
  AppSection.tsx
```

The exact file names may differ, but the following concepts must exist:

- authenticated workspace shell,
- primary navigation/sidebar,
- topbar or header area,
- page title/header pattern,
- content container pattern,
- breadcrumbs or route context,
- reusable empty/loading/error states,
- responsive behavior suitable for desktop and iPad.

### Rules

- Pages should compose shell primitives rather than inventing layout from scratch.
- Shell must be design-token driven.
- Shell must not contain annotation-domain business logic.
- Shell should be accessible and keyboard-friendly.

### Acceptance Criteria

- `/app`, `/app/projects`, project detail/image pages share the same shell.
- Shell docs exist in `docs/01-architecture/app-shell.md`.
- Any removed/deprecated shell implementation is deleted or clearly replaced.
- Focused commit exists, for example:
  - `refactor: add reusable workspace app shell`

---

## Slice 5 — Design System and Token Baseline

### Goal

Move colors, fonts, radii, surfaces, semantic states, and mode differences out of production components and into a central design-token/theme layer.

### Required design files

Create or consolidate:

```text
src/design/
  tokens.css
  themes.css
  README.md
```

or keep under `src/styles/` if Codex documents and justifies that choice. The important point is: one canonical design-token layer, not scattered component styling.

### Required token groups

At minimum:

- background / foreground,
- surface / card / popover,
- primary / secondary / accent,
- muted / border / input / ring,
- destructive / warning / success / info,
- sidebar/shell-specific tokens,
- annotation label tokens:
  - sapwood,
  - heartwood,
  - copper,
  - instance/support,
  - selected/hovered/conflict,
- typography tokens:
  - sans,
  - mono,
  - base size,
  - heading/body/caption scale,
- spacing/radius/shadow tokens as needed.

### Hard rules

Production components must not hard-code design values such as:

- hex colors (`#...`),
- raw `rgb(...)` / `oklch(...)` values,
- one-off font families,
- one-off theme-specific colors,
- inline color styles.

Allowed:

- centralized token definitions may contain raw color values,
- generic layout utility classes are allowed (`flex`, `grid`, `gap-4`, etc.),
- semantic Tailwind token classes are encouraged (`bg-background`, `text-foreground`, `border-border`, `bg-card`, etc.),
- canvas rendering code may map annotation labels to token-derived or centrally defined colors, but not local hard-coded colors.

### Optional but recommended

Add a simple check script such as:

```json
"check:design-hardcoding": "..."
```

The script may use `rg` to detect raw color literals outside approved design-token files. It does not need to be perfect, but it should catch obvious regressions.

### Acceptance Criteria

- `globals.css`, existing `theme.css`, and style imports are consolidated or clearly layered.
- Light and dark theme behavior is possible through theme tokens/classes.
- Components use semantic token classes instead of raw color values.
- `docs/05-design-system/tokens.md`, `components.md`, and `theming.md` are updated.
- Focused commit exists, for example:
  - `refactor: centralize design tokens and theming`

---

## Slice 6 — Component Reuse and Prototype Cleanup

### Goal

Remove or isolate prototype duplication so future feature work builds on reusable components.

### Tasks

- Review existing components under `src/components/**` and route-local UI.
- Identify reusable vs feature-specific vs obsolete components.
- Move feature-specific components into the correct `src/features/**` area.
- Keep generic primitives in `src/components/ui/**`.
- Remove active duplicate flows where safe, especially duplicate App Shell/editor entry points.
- Do not rewrite the whole editor; only clean architecture boundaries enough to avoid future duplication.

### Required docs

Update:

- `docs/03-features/README.md`
- `docs/03-features/editor.md`
- `docs/05-design-system/components.md`
- `docs/08-adr/remediation-backlog.md` for deferred editor/domain issues.

### Acceptance Criteria

- Components have clear ownership.
- No obvious active duplicate shell/layout system remains.
- Deferred editor/domain debts are documented instead of silently fixed.
- Focused commit exists, for example:
  - `refactor: clarify component ownership and remove shell duplication`

---

## Slice 7 — Quality Gates and Final Documentation Alignment

### Goal

Make the new baseline enforceable.

### Tasks

- Ensure scripts exist for common checks:
  - lint,
  - build,
  - Prisma generate,
  - optional design-hardcoding check.
- Run relevant checks and document final results.
- Update `AGENTS.md` if new repo-specific rules emerged.
- Update `ARCHITECTURE.md` to match the final architecture map.
- Update docs index links.

### Acceptance Criteria

- Final check results are recorded in `docs/00-overview/baseline-checks.md`.
- `AGENTS.md` and `ARCHITECTURE.md` are aligned with implementation.
- `docs/README.md` navigation works.
- If any checks still fail, failures are documented and placed in remediation backlog with context and priority.
- Final focused commit exists, for example:
  - `chore: align docs and quality gates for architecture baseline`

---

# Acceptance Criteria for Entire Ticket

This ticket is complete when:

1. The repository has a documented current-state baseline.
2. A navigable `docs/` tree exists and mirrors the repository structure.
3. App routes are thin and modular.
4. A reusable authenticated App Shell exists.
5. Design tokens and themes are centralized.
6. Production components no longer hard-code colors/fonts/styles except through approved tokens.
7. Component ownership is clear.
8. Existing duplicate shell/layout flows are removed or explicitly deprecated.
9. `AGENTS.md` and `ARCHITECTURE.md` are updated.
10. Relevant checks are run and documented.
11. Each meaningful implementation slice has a focused Git commit.

## Suggested Commit Sequence

Codex should not force this exact sequence, but should aim for similarly focused commits:

1. `docs: record initial architecture baseline`
2. `docs: add repository documentation skeleton`
3. `refactor: establish app router and feature module baseline`
4. `refactor: add reusable workspace app shell`
5. `refactor: centralize design tokens and theming`
6. `refactor: clarify component ownership and remove shell duplication`
7. `chore: align docs and quality gates for architecture baseline`

## Notes for Codex

- This is an architecture-foundation task, not a product-feature task.
- Do not optimize for minimal diff at the expense of future maintainability.
- Do not introduce heavy abstractions without immediate benefit.
- Prefer simple, explicit modules with clear ownership.
- Preserve working behavior where reasonable, but because this is pure development with no production data, remove prototype debt instead of preserving bad structure.
- Keep documentation evidence-backed: reference actual paths and mark future/planned behavior honestly.
