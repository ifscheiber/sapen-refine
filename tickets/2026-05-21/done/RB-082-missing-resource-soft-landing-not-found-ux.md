# RB-082 — Missing Resource Soft Landing & SaPen Annotate Not Found UX

## Status

Implemented

## Priority

High

## Type

Routing / UX / Error Boundary / Not Found / Customer Trial Hardening / Tests

## Context

Manual testing opened a stale image editor URL after DB rebuild:

```text
/app/projects/demo_project/images/<deleted-image-id>/edit
```

The image no longer existed. The page threw:

```ts
throw new Error("IMAGE_NOT_FOUND")
```

This produced a raw error instead of a soft landing.

This can happen in normal use:

- user opens stale browser history URL,
- image was deleted,
- DB was rebuilt in dev,
- wrong copied link,
- project/image mismatch.

Users should land on a SaPen Annotate-specific not-found or missing-resource page.

---

## Goal

Implement graceful missing-resource handling and SaPen Annotate-specific not-found UX.

At the end of RB-082:

1. Missing image/editor URLs do not throw raw `IMAGE_NOT_FOUND`.
2. Missing project/image/task/export/prediction pages use safe not-found or soft-landing behavior.
3. A SaPen Annotate-specific not-found page exists.
4. Users get helpful navigation back to project images, project overview or workspace.
5. Tests cover stale/missing image editor URLs.

---

## Non-Goals

Do **not** implement:

- deletion workflow,
- undelete/restore,
- new RBAC semantics,
- API error contract changes,
- schema changes,
- new product features.

RB-072 handles API JSON errors. RB-082 handles App Router/page UX.

---

## Scope

### 1. Editor missing image handling

Replace raw throws in editor page paths with one of:

```ts
notFound()
```

or a project-aware soft landing.

Preferred behavior:

- project exists but image missing:
  - show “Image not found or no longer available”
  - link to project images
  - link to project overview
- project missing:
  - app/project not-found
  - link to workspace/projects.

### 2. Custom not-found pages

Add SaPen Annotate-specific not-found UI, for example:

```text
src/app/not-found.tsx
src/app/(workspace)/app/not-found.tsx
src/app/(workspace)/app/projects/[projectId]/not-found.tsx
```

Use existing App Shell/design components where appropriate.

### 3. Audit common raw throws

Search:

```bash
rg -n "throw new Error\(|IMAGE_NOT_FOUND|PROJECT_NOT_FOUND|TASK_NOT_FOUND|EXPORT_NOT_FOUND" src/app src/features
```

Classify:

```text
should become notFound()
should become soft landing
should remain internal error
```

Fix representative high-risk stale URL paths.

### 4. Friendly UX

The page should show:

- SaPen Annotate branding,
- concise explanation,
- likely causes,
- actions:
  - back to projects,
  - project overview if known,
  - project images if known.

Do not leak sensitive resource existence beyond current access policy.

---

## Tests

Add tests for:

- stale image editor URL renders friendly not-found/soft landing,
- generic unknown app path renders SaPen Annotate not-found page,
- project/image mismatch handled safely,
- valid image editor route still works.

---

## Acceptance Criteria

1. `git status --short` is clean.
2. Stale image editor URL no longer throws raw `IMAGE_NOT_FOUND`.
3. SaPen Annotate-specific not-found UI exists.
4. Users get safe navigation from missing-resource pages.
5. Sensitive existence data is not leaked beyond current policy.
6. Tests cover missing image/editor URL.
7. Existing editor/browser workflows remain green.
8. Ticket is moved to `tickets/2026-05-21/done/`.
9. Full validation gate passes.
