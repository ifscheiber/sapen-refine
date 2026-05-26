# RB-064 — Auth, RBAC & Audit Hardening

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Security / Auth / RBAC / Audit / Customer Trial Readiness / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-062 — Repository State & Documentation Consistency Sweep
- RB-063 — Project Operations UX Split

## Blocks

- RB-069 — Customer Trial Deployment, Handoff Hygiene & iPad Safari Gate
- Customer-facing trial access
- Reliable attribution for customer annotations/imports/exports

---

## 1. Context

RB-063 split project operations into route-addressable areas and kept all domain behavior unchanged.

The current next risk is customer-trial security and attribution. The RB-064 draft correctly identifies the major issues:

- project role rules are repeated across route handlers and domain services,
- the login page still exposes local demo credentials in the development-oriented flow,
- login `next` handling should only allow safe same-app redirects,
- there is no login rate limiting, account lockout, or same-origin mutation guard,
- `Session.lastSeenAt` can write on every authenticated request,
- audit logging is not consistently attached to every mutation,
- worker/system actor identity is not fully defined for background-style processing. fileciteturn18file0

This ticket hardens the current app for a realistic customer-facing single-host trial.

It is not an enterprise identity-provider implementation.

---

## 2. Goal

Centralize and harden authentication, authorization, and audit behavior before customer trial access.

At the end of RB-064:

1. Permission checks for main project actions are centralized.
2. Route/domain modules use shared policy helpers for the most important actions.
3. Login redirect handling is safe.
4. Demo credentials are not shown in customer/trial contexts by default.
5. Minimal brute-force/rate-limit protection exists for login.
6. Cookie-authenticated mutation routes have a same-origin/CSRF-style guard where practical.
7. Session last-seen updates are throttled.
8. Token-bearing debug logs are removed.
9. Audit coverage is improved for critical mutations.
10. Worker/system actor identity is defined for operational tasks.
11. Existing workflows remain green.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- full enterprise identity provider,
- SSO/OIDC/SAML,
- password reset email flow,
- organization billing/multi-tenant administration,
- broad user-management UI,
- complete audit dashboard,
- full CSRF framework if a focused same-origin mutation guard is sufficient,
- annotation domain model changes,
- changing ground-truth/review/export semantics,
- changing project membership rules beyond centralizing existing policy,
- large route rewrites.

If a security improvement is too large, add a precise follow-up entry.

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

Because this ticket touches auth/RBAC, run relevant integration/E2E tests after each major security change.

---

## 5. Scope

### 5.1 Current permission audit

Before refactoring, document current permission behavior.

Create/update:

```text
docs/04-server/auth-rbac-audit.md
docs/08-adr/remediation-backlog.md
```

Map existing role behavior for:

- project read,
- image upload,
- metadata edit,
- semantic/support/classification annotation,
- review/approval,
- ground-truth training export,
- prediction-analysis export,
- prediction provenance/model-run creation,
- prediction import,
- correction task management,
- assisted correction,
- batch prediction import create/process/retry,
- batch inspection,
- admin/trial user creation where applicable.

This mapping should distinguish:

```text
implemented policy
ambiguous / duplicated policy
known gap
deferred hardening
```

### 5.2 Central permission/policy layer

Add a central policy layer.

Suggested location:

```text
src/server/auth/policies.ts
```

or:

```text
src/server/policies/projectPermissions.ts
```

Define explicit helpers such as:

```ts
canReadProject(...)
canManageProject(...)
canUploadImage(...)
canEditMetadata(...)
canAnnotate(...)
canSubmitReview(...)
canReview(...)
canExportTraining(...)
canExportPredictionAnalysis(...)
canCreateModelRun(...)
canCreatePredictionRun(...)
canImportPrediction(...)
canManageCorrectionTasks(...)
canWorkOnCorrectionTask(...)
canProcessPredictionBatch(...)
canViewAudit(...)
```

Exact names may differ.

Rules:

- helpers must be server-side and testable,
- route handlers/domain services should not reimplement role logic,
- policy should be based on project membership and role,
- if system/worker actor is needed, model it explicitly in helper inputs,
- keep default behavior equivalent to current working behavior unless a current behavior is clearly unsafe.

Do not attempt to refactor every single route if that becomes too large. Prioritize high-risk mutation routes.

### 5.3 Incremental route/domain adoption

Refactor important route/domain modules to use the policy layer.

Priority order:

1. project read/mutation,
2. image upload and metadata edit,
3. annotation/mask commit,
4. review/approval,
5. training export,
6. prediction-analysis export,
7. prediction import,
8. correction task management,
9. batch prediction import processing/retry,
10. model/prediction run creation.

If complete adoption is too large, finish the high-risk routes and document remaining route checks.

### 5.4 Login hardening

#### Safe redirect handling

Login `next` parameter must be sanitized.

Rules:

- allow only same-app relative paths,
- reject absolute URLs,
- reject protocol-relative URLs,
- reject suspicious paths such as `//evil.com`,
- default to `/app` or the current canonical workspace route.

Add tests.

#### Demo credentials

Do not show shared seed/demo credentials in customer-facing mode.

Suggested behavior:

- show demo credentials only if:
  - `NODE_ENV === "development"`, or
  - explicit config flag like `SHOW_DEMO_CREDENTIALS=true`.
- `.env.example` documents the flag.
- trial deployment docs state demo credentials must not be enabled for customer trial unless explicitly accepted.

#### Rate limiting / brute-force protection

Implement minimal login rate limiting suitable for single-host trial.

Acceptable implementation options:

- DB-backed per-email/per-IP attempt tracking,
- in-memory limiter with clear limitation documented,
- simple per-email cooldown if DB-backed is easy.

Preferred for trial: DB-backed if practical.

Minimum behavior:

- repeated failed login attempts get delayed or blocked temporarily,
- successful login clears relevant failed attempts,
- responses do not reveal whether email exists,
- tests cover lockout/rate-limit behavior.

If a DB migration is needed for login attempts, keep it narrow and documented.

#### Session last-seen throttling

Avoid writing `Session.lastSeenAt` on every authenticated request.

Suggested behavior:

- update only if older than a configured threshold, e.g. 5 or 15 minutes.
- document threshold.
- test helper behavior if practical.

#### Token/log hygiene

Remove token-bearing debug logs.

Audit/logs may include session id if non-sensitive, but should not include raw session token.

### 5.5 Same-origin mutation guard

Add a focused same-origin/CSRF-style guard for cookie-authenticated mutation routes.

Minimum:

- for unsafe methods (`POST`, `PATCH`, `PUT`, `DELETE`),
- validate `Origin` or `Sec-Fetch-Site` where present,
- allow same-origin / same-site according to deployment,
- reject cross-site mutation attempts with stable sanitized error,
- document local/dev behavior.

This does not need to be a full CSRF token framework in RB-064 unless trivial.

Add helper and tests.

Suggested location:

```text
src/server/auth/requestGuards.ts
```

Adopt in high-risk mutation routes or a shared wrapper if the app has one.

### 5.6 Audit coverage

Improve audit coverage for important mutations.

Minimum actions to verify or add:

- login success/failure/lockout if audit model supports it,
- project metadata update,
- image upload accepted/rejected,
- metadata update,
- semantic/support mask commit,
- review decision,
- training export created/downloaded,
- prediction-analysis export created/downloaded,
- model run / prediction run creation,
- prediction import,
- correction task create/update,
- assisted correction save,
- batch import create/process/retry.

If audit events already exist, make action naming consistent.

If exhaustive coverage is too large, update high-risk routes now and document remaining gaps.

### 5.7 Worker/system actor identity

Define how batch/operational processing is attributed.

Options:

- use explicit system actor id from config,
- use a `SYSTEM` actor representation if schema supports it,
- record `actorId` as initiating user and `processor` metadata as system process,
- document limitation if no true system user exists.

RB-064 does not need to build a full worker identity system, but it must define and document current behavior for RB-065.

---

## 6. Tests

### 6.1 Unit tests

Cover:

- permission helpers for each role/action,
- safe next redirect sanitizer,
- same-origin mutation guard,
- session last-seen throttle helper,
- login rate-limit helper if isolated.

### 6.2 Integration tests

Cover:

- viewer cannot mutate protected resources,
- labeler can annotate but not approve/export/admin-import if policy says so,
- QA/owner can perform prediction import/export/task/batch actions as intended,
- unauthorized cross-origin mutation is rejected on at least representative routes,
- login rate limiting/lockout,
- demo credentials hidden/config-controlled where testable,
- audit events are created for representative critical mutations.

### 6.3 E2E tests

Existing E2E must remain green.

Add/adjust only if useful:

- login with safe redirect,
- invalid external `next` is ignored/sanitized,
- project operations routes still accessible after RBAC refactor.

---

## 7. Documentation Updates

Update:

```text
docs/04-server/auth-rbac-audit.md
docs/04-server/deployment-trial.md
docs/04-server/backup-restore.md
docs/03-features/projects.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
README.md
.env.example
```

Docs must state:

- role/action matrix,
- login hardening behavior,
- demo credential visibility rules,
- rate-limit/lockout limitations,
- same-origin mutation guard behavior,
- audit coverage and remaining gaps,
- worker/system actor attribution behavior,
- customer trial recommendations.

---

## 8. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Main project action permissions are represented in a central policy layer.
3. High-risk route/domain checks use the central policy helpers.
4. Login `next` cannot redirect to arbitrary external URLs.
5. Demo credentials are hidden outside local/dev or explicit opt-in.
6. Minimal login rate-limit/brute-force protection exists and is tested.
7. `Session.lastSeenAt` writes are throttled.
8. Token-bearing debug logs are removed.
9. Same-origin mutation guard exists and protects representative unsafe routes.
10. Audit coverage is improved for key mutation paths.
11. Worker/system actor attribution behavior is documented.
12. Existing app workflows remain green.
13. Auth/RBAC/audit tests are added/updated.
14. Docs and trial runbooks are updated.
15. Remaining security gaps are documented as follow-up backlog entries.
16. Ticket is moved to:

```text
tickets/2026-05-20/done/
```

17. Final validation passes:

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

18. Final Codex report includes:
    - commits created,
    - routes/services changed,
    - policy helpers added,
    - auth hardening added,
    - audit actions added/changed,
    - tests added/changed,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 9. Suggested Commit Sequence

```bash
git commit -m "docs: map auth rbac audit hardening baseline"
git commit -m "feat: add centralized project permission policies"
git commit -m "refactor: apply policies to critical project actions"
git commit -m "feat: harden login redirects and demo credentials"
git commit -m "feat: add login rate limiting and mutation origin guard"
git commit -m "feat: improve audit coverage for critical mutations"
git commit -m "test: cover auth rbac audit hardening"
git commit -m "docs: document auth rbac audit trial posture"
git commit -m "chore: finalize auth rbac audit ticket"
```

---

## 10. Notes for Codex

- This is customer-trial hardening, not enterprise auth.
- Centralize policy without changing intended permissions.
- Prefer small shared helpers and route-by-route adoption over one risky refactor.
- Keep every existing workflow green.
- Be conservative with schema changes.
