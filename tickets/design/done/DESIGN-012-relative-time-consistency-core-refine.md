# DESIGN-012 — Relative Time Consistency with SaPen Core and Refine

## Status

Done

## Type

UI consistency / date formatting ticket

## Repository / path context

Work in the `sapen-annotate` repository.

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only visual/layout/reference material. Do not import directly from `../sapen` at runtime unless the repository is intentionally configured for this.

## General boundary

Preserve existing storage contracts, API contracts, auth/RBAC behavior, editor canvas behavior, mask serialization, and Core handoff contracts unless the ticket explicitly asks for a small local UI-support addition.

Do not port SaPen Core logic wholesale into `sapen-annotate`.
Do not introduce CDN fonts/icons/Tailwind.
Do not add a new component library.


## Goal

Use the same relative-time display semantics in `sapen-annotate` that SaPen Core uses in comparable UI surfaces.

Examples:

```text
Updated 1 min ago
Updated 6 d ago
now
2 h ago
Yesterday
```

The exact wording should follow the existing SaPen Core helper, not a newly invented formatter.

## Background

SaPen Core already has a dedicated relative-time helper:

```text
../sapen/apps/sapen-core/src/features/projects/utils/relativeTime.ts
```

It is used in Core sidebar/workspace/quick-analysis areas. SaPen Annotate should use the same approach where it shows recently updated/opened/created timestamps.

## Required reference inspection

Inspect:

```text
../sapen/apps/sapen-core/src/features/projects/utils/relativeTime.ts
../sapen/apps/sapen-core/tests/unit/relative-time.test.ts
../sapen/apps/sapen-core/src/features/projects/ProjectsSidebar.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceLayout.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisSidebar.tsx
../sapen/apps/sapen-core/src/features/experiments/preparation/images/ImagesPreparationView.tsx
```

Also inspect local `sapen-annotate` usage of timestamps:

```text
src/app
src/components
src/features
src/lib
```

Search local repo for:

```text
updatedAt
createdAt
lastOpenedAt
openedAt
Updated
ago
toLocale
toISOString
Intl.RelativeTimeFormat
formatRelativeTime
```

## Required changes

### 1. Add or reuse a canonical relative-time helper

If `sapen-annotate` already has a relative-time helper, align it with SaPen Core semantics.

If not, add a small local helper, preferably mirroring the Core helper behavior.

Suggested local location:

```text
src/lib/relativeTime.ts
```

or the existing local util location.

Do not import directly from `../sapen/...` at runtime unless the repo is configured for shared package imports.

### 2. Use relative time wherever Core uses relative time

Apply the helper consistently in UI surfaces such as:

- project sidebar rows
- image sidebar rows
- Projects page image table
- image summary
- recent activity if present
- editor sidebar image list
- upload/project metadata rows where appropriate

Use absolute timestamps only where precision is the primary purpose, or as a tooltip/title.

Recommended pattern:

```tsx
<span title={absoluteTimestamp}>
  Updated {formatRelativeTime(updatedAt, now)}
</span>
```

Use existing app conventions for `now` injection if present. Avoid hydration instability if this is server-rendered.

### 3. Preserve deterministic testing

If existing tests depend on fixed time, use an injectable `now` parameter like SaPen Core does.

Do not call `new Date()` deep inside components if it makes tests unstable and the Core pattern uses `now`.

## Acceptance criteria

- [ ] SaPen Annotate has a canonical relative-time helper aligned with SaPen Core.
- [ ] Project sidebar rows use relative time.
- [ ] Image sidebar rows use relative time.
- [ ] Projects page image table uses relative time where appropriate.
- [ ] Absolute timestamps remain available via tooltip/title where useful.
- [ ] No inconsistent `toLocaleString()`/raw ISO display remains in Core-like UI surfaces unless intentionally required.
- [ ] Tests are updated/added for relative-time formatting if feasible.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

Use repo-appropriate scripts if names differ.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement DESIGN-012: Relative Time Consistency with SaPen Core and Refine.

First inspect:
../sapen/apps/sapen-core/src/features/projects/utils/relativeTime.ts
../sapen/apps/sapen-core/tests/unit/relative-time.test.ts
../sapen/apps/sapen-core/src/features/projects/ProjectsSidebar.tsx
../sapen/apps/sapen-core/src/components/workspace/WorkspaceLayout.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisSidebar.tsx

Then inspect local sapen-annotate timestamp usage.

Goal:
Use the same relative-time semantics in sapen-annotate wherever Core-like UI surfaces show recent updates/opened/created times.

Add or align a local relative-time helper if needed. Do not import directly from ../sapen at runtime unless already supported.

Apply to:
- project sidebar rows
- image sidebar rows
- Projects page image table/list
- image summary/recent activity where present

Preserve absolute timestamps as title/tooltip where useful.

Run validation and report:
A. helper added/aligned
B. files changed
C. surfaces updated
D. validation results
```

## Suggested commit message

```text
Align annotate relative time formatting with SaPen Core
```
