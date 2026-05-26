# RB-121 - Annotator Role Workspace Surface And API Access Boundary

## Status

Done

## Priority

P1/P2 for customer trial UX and access-boundary correctness

## Type

RBAC / Product Surface / UX Hardening / API Authorization / Tests

## Source

- Post DESIGN-001 / DESIGN-002 manual product review.
- User finding: the normal customer-facing user role should be an `annotator`-type role with a minimal workspace surface.
- Completed DESIGN-001: SaPen Annotate login page redesign with SaPen Core reuse.
- Completed DESIGN-002: authenticated shell and active-project image workspace aligned with SaPen Core.
- Completed RB-106: protected API error contracts.
- Completed RB-116: audit coverage matrix and route guard.
- Completed RB-117: CLI secret handling hardening.
- RB-113 remains open as real iPad Safari evidence gate.

## Target Repository

Work in the `sapen-annotate` repository.

If SaPen Core is used only as visual/product reference, remember that it is located at:

```text
../sapen/...
```

Do not import directly from `../sapen/...` unless the repo is intentionally configured for that.

## Context

After the login and authenticated shell redesign, the primary customer-facing workflow became clearer:

Most customer users will not be export managers, prediction-import operators, or administrators. They will mostly annotate.

For the normal customer-facing role, called `annotator` in this ticket, it is sufficient and desirable that the user can:

- create an annotation project if product policy allows it,
- upload images to accessible projects,
- open the image/crop annotation workspace,
- create and update bounding boxes,
- create and update support masks,
- create and update semantic masks,
- save, reload, and continue annotation work.

The same user should not see or access advanced/operational features such as:

- Exports,
- Export Jobs,
- Tasks unless they are explicitly annotation tasks,
- Prediction Imports,
- Prediction Analysis,
- cleanup/admin/operator tools,
- worker/process-due routes.

This is both a UX issue and an access-boundary issue. Hiding navigation items is not enough; direct API access must also be forbidden.

## Goal

Define and enforce the minimal Annotator role surface across the SaPen Annotate UI and API.

The goal is that the most common customer user sees a focused annotation workspace and cannot accidentally or directly access export, prediction, task, or operator functionality.

## Non-Goals

- Do not redesign the whole RBAC model unless required by current schema constraints.
- Do not implement a full organization/department permission system.
- Do not implement public sharing or anonymous access.
- Do not change annotation canvas behavior except to hide or disable inaccessible actions.
- Do not remove export/prediction/admin functionality for privileged roles.
- Do not implement Core handoff actor provenance; see RB-115-C.
- Do not implement unattended worker actor context; see RB-115-B.
- Do not complete or fabricate RB-113 iPad Safari evidence.
- Do not start RB-118 public-upload hardening follow-ups here.

## Required Investigation

Inspect the current post-DESIGN-002 repo state before implementation.

At minimum, inspect:

### Auth / RBAC / Roles

- Prisma schema role/project membership models.
- Current project membership roles and global roles.
- Auth/RBAC helpers.
- API authorization helpers.
- Existing tests around role/project access.

Likely files/areas may include:

```text
prisma/schema.prisma
src/server/auth
src/server/rbac
src/server/projects
src/app/api
docs/auth-rbac-audit
docs/testing/audit-coverage-matrix.md
```

Use actual repo paths if they differ.

### Shell / Navigation / Workspace UI

Inspect current redesigned shell/workspace files from DESIGN-002, especially:

```text
src/app/app/AppShell.tsx
src/components
src/app/app/projects/page.tsx
src/app/app/projects/[projectId]/page.tsx
src/app/app/projects/[projectId]/images/ui.tsx
```

Use actual repo paths if they differ.

### Advanced Features To Gate

Inventory all UI routes/nav/actions and API routes related to:

- Exports,
- Export Jobs,
- Prediction Imports,
- Prediction Analysis,
- Tasks / Correction Tasks,
- Cleanup / Admin / Worker processing,
- process-due endpoints,
- operator-only scripts/routes.

Use the RB-116 audit coverage matrix as a cross-check.

## Role Definition

This ticket uses the term `annotator` as product shorthand.

Before implementing, determine how this maps to existing roles:

- existing project role such as `MEMBER`,
- existing global role,
- new role enum/value if already appropriate,
- capability mapping layered on top of existing roles.

Prefer the smallest safe change.

If the repo already has a role that semantically means annotator/member, use it and document the product name.

If a new role is required, add migration/tests/docs. Do not add a new role casually if capability mapping is enough.

## Required Capability Policy

Define a central capability/policy helper rather than scattering role checks throughout the UI.

Suggested capabilities:

```text
project:create
project:uploadImage
annotation:openWorkspace
annotation:editBoundingBoxes
annotation:editSupportMasks
annotation:editSemanticMasks
annotation:reviewOwnWork or annotation:review if applicable

export:view
export:create
export:download
export:processJobs

predictionImport:view
predictionImport:create
predictionImport:process

tasks:view
tasks:manage
correctionTasks:view
correctionTasks:manage

admin:cleanup
admin:processWorkers
admin:viewOperationalReports
```

The exact names can differ if the repo already has conventions. The important requirement is a clear, reusable boundary.

## Annotator Allowed Surface

For the Annotator role, allow:

### UI

- Login.
- Project list/workspace.
- Create project, if product policy confirms annotators may create projects.
- Select active project.
- Upload images into accessible project.
- View image list and previews.
- Open annotation/editor/crop workspace.
- Create/update BBoxes.
- Create/update support masks.
- Create/update semantic masks.
- Save/reload annotation work.
- See only annotation-relevant status messages.

### API

Allow only authenticated, project-scoped APIs needed for the above actions.

Every allowed write must remain attributable under the RB-115/RB-116 audit model.

## Annotator Forbidden Surface

For Annotator, hide from UI and forbid direct API access to:

### UI Navigation / Actions

- Exports navigation.
- Export job/status management pages unless only showing own already-created download is intentionally allowed.
- Create export actions.
- Prediction Imports navigation.
- Prediction Analysis export actions.
- Correction Tasks / Tasks navigation unless they represent assigned annotation work and are explicitly allowed.
- Admin/operator/cleanup/process-due controls.
- Worker/process buttons.
- Operational reports.

### API

Direct calls should return stable API errors, preferably:

- `403 FORBIDDEN` with existing RB-106 JSON error shape for authenticated users without permission;
- `401 UNAUTHENTICATED` for missing/invalid sessions.

Do not rely only on client-side hiding.

## Privileged Roles

Preserve existing functionality for privileged roles.

Define expected access for at least:

- project owner / manager,
- admin / operator,
- reviewer if such a role exists,
- future export/prediction operator if modeled separately.

Do not accidentally remove export/prediction/admin functionality from roles that legitimately need it.

## Product Policy Questions To Resolve In Implementation

If not already defined, make a conservative choice and document it:

1. Can an Annotator create new projects?
   - Resolved during implementation: plain Annotator/`LABELER` users cannot create projects. Project creation is limited to global `ADMIN` users and users that already own at least one annotation project.
2. Can an Annotator invite/manage other users?
   - likely no.
3. Can an Annotator review/approve ground truth?
   - likely no unless review is part of annotation role.
4. Can an Annotator see Tasks?
   - no, unless tasks are explicitly assigned annotation tasks.
5. Can an Annotator download any export?
   - likely no.
6. Can an Annotator see prediction proposals/corrections?
   - only insofar as they are part of annotation UI, not prediction-import/admin pages.

Document decisions in auth/RBAC docs.

## Implementation Requirements

### 1. Capability Map

Add or update a central capability helper for UI and API use.

Requirements:

- deterministic and testable;
- based on existing global/project role data;
- easy to extend for future roles;
- no duplicated ad-hoc string checks in components/routes if avoidable.

### 2. UI Gating

Update shell/sidebar/workspace UI so Annotator does not see restricted features.

Targets include:

- top navigation,
- left sidebar actions,
- right rail/utility actions,
- project workspace action buttons,
- image table row actions,
- export/prediction/task links,
- any empty-state CTAs.

Use capability checks, not one-off role-name checks, where practical.

### 3. API Gating

Update protected API routes so restricted actions are server-enforced.

At minimum, check APIs for:

- export creation/status/admin/job processing/download where relevant,
- prediction import creation/upload/process/retry,
- prediction-analysis export creation,
- correction task creation/management if not annotator-facing,
- cleanup/admin/process-due endpoints,
- membership/admin operations.

Annotation APIs required by Annotator must continue to work.

### 4. Stable Error Contract

Use the RB-106 error contract.

Tests must verify that direct forbidden calls from Annotator return stable JSON `403`, not generic framework errors.

### 5. Tests

Add or update tests for:

#### Capability Unit Tests

- Annotator allowed capabilities.
- Annotator forbidden capabilities.
- Owner/Admin/Operator preserved capabilities.
- Project-scoped role behavior.

#### API Authorization Tests

For an Annotator user, direct API calls to restricted endpoints return `403`.

Include at least:

- export creation,
- prediction import creation,
- prediction-analysis export creation if present,
- cleanup/admin/process-due route,
- task/correction-task management if present.

Also test that Annotator can still:

- create project if allowed,
- upload image,
- save BBox/support/semantic mask.

#### UI Visibility Tests

E2E or component tests should verify:

- Annotator does not see Exports navigation/actions.
- Annotator does not see Prediction Imports.
- Annotator does not see admin/cleanup/worker controls.
- Annotator can reach image annotation workspace.

If full E2E is too heavy, add targeted UI tests and document remaining manual check.

### 6. Documentation

Update docs to define the role/product surface.

Likely docs:

```text
docs/auth-rbac-audit
docs/00-overview/current-state.md
docs/00-overview/customer-trial-readiness.md
docs/known-gaps.md
docs/testing/audit-coverage-matrix.md
```

Document:

- product name `Annotator`,
- mapping to current role(s),
- allowed capabilities,
- forbidden capabilities,
- API enforcement expectations,
- remaining limitations/follow-ups.

Do not claim RB-113 iPad evidence exists.

## Acceptance Criteria

- Annotator role/capability policy is explicitly defined.
- Annotator UI surface is limited to project/image upload/annotation workflows.
- Annotator cannot see Exports, Export Jobs, Prediction Imports, Prediction Analysis, admin/operator tools, or non-annotation Tasks.
- Direct Annotator API access to restricted endpoints returns stable `403` JSON.
- Annotator can still perform allowed annotation workflow:
  - create project if allowed,
  - upload images,
  - open workspace,
  - save BBoxes,
  - save support masks,
  - save semantic masks.
- Privileged roles retain their intended export/prediction/admin access.
- Tests cover capability map, UI visibility, and API denial/allowance.
- Docs describe Annotator role and customer-facing surface.
- RB-113 remains open unless real physical iPad evidence was provided separately.
- Worktree is clean and handoff dry-run passes.

## Validation

Run:

```bash
git status --short
git diff --check
npm run prisma:generate
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run check:docs-links
npm run handoff:archive -- --dry-run
```

If migrations are added, also run:

```bash
npm run db:rebuild
npm run test
```

If E2E is not feasible locally, document why and run targeted tests instead.

## Manual Smoke Checklist

After implementation, manually verify with at least two accounts:

### Annotator Account

- Login.
- Create/select project.
- Upload image.
- Open image/crop workspace.
- Save BBox/support/semantic mask.
- Confirm no Exports/Prediction/Admin/Tasks surface is visible.
- Attempt direct restricted URL/API if practical and confirm forbidden response.

### Privileged/Admin Account

- Login.
- Confirm export/prediction/admin surfaces still appear where expected.
- Confirm existing export/prediction workflows are not broken.

## Completion Protocol

1. Implement capability map and UI/API gating.
2. Add tests.
3. Update docs/backlog/sprint index.
4. Add follow-up tickets if role model gaps are discovered.
5. Leave RB-113 open unless physical iPad evidence exists.
6. Commit the completed slice.
7. Ensure `npm run handoff:archive -- --dry-run` passes.

## Implementation Notes

- `Annotator` maps to the existing Prisma project role `LABELER`; no schema migration was added.
- Added a central project/global capability map in `src/server/auth/policies.ts`.
- Restricted project creation to global `ADMIN` users and users with at least one existing `OWNER` project membership.
- Kept `LABELER` access focused on project/image upload and direct annotation workflows.
- Hid project settings, exports, prediction imports, prediction-analysis, correction tasks, and operational status counts from the Annotator UI.
- Enforced direct API denial for restricted Annotator access with stable RB-106 JSON `403 FORBIDDEN` responses.
- Preserved `VIEWER` as read-only; `VIEWER` does not receive annotation edit capabilities.
- Fixed an image-list reload race where a stale initial image fetch could hide a just-uploaded image in browser workflows.
- Updated docs and tests for the finalized role boundary.

## Notes For Codex

- Treat this as a product-surface and authorization-boundary ticket.
- Do not only hide UI; enforce API permissions.
- Use existing RBAC/auth helpers where possible.
- Do not overbuild a full enterprise permission system.
- Keep annotation workflows working for the normal customer user.
- Preserve privileged role functionality.
- Do not fabricate RB-113 evidence.
