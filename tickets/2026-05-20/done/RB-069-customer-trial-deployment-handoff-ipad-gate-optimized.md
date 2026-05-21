# RB-069 — Customer Trial Deployment, Handoff Hygiene & iPad Safari Gate

## Status

Done

## Priority

High

## Type

Deployment / Handoff / Trial Readiness / iPad Smoke / Storage Hygiene / Security Hygiene / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-062 — Repository State & Documentation Consistency Sweep
- RB-063 — Project Operations UX Split
- RB-064 — Auth, RBAC & Audit Hardening
- RB-065 — Batch Job Runner Hardening
- RB-066 — Batch/Staging Storage Retention & Cleanup
- RB-068 — Editor Decomposition

## Blocks

- Real customer-facing browser trial
- Real iPad Safari validation
- External/customer handoff of the repository/deployment package

---

## 1. Context

RB-040 through RB-068 established a feature-complete trial baseline for SaPen Annotate:

- standalone annotation domain,
- metadata workflow,
- semantic/support/classification annotation,
- review/approval,
- ground-truth export,
- prediction provenance/import,
- active-learning correction tasks,
- assisted correction,
- prediction-analysis export,
- batch import with runner and cleanup,
- project operations split,
- auth/RBAC/audit hardening,
- editor decomposition.

The original RB-069 draft identifies the remaining customer-trial readiness risks:

- internal ZIP handoffs can accidentally include `.git`, caches, local test results, build outputs or secrets,
- real iPad Safari smoke is still deferred until deployment/device access exists,
- `src/server/storage.ts` is an unused legacy duplicate helper,
- asset download routes should defensively encode/sanitize filenames in `Content-Disposition`.

RB-069 is the release/handoff gate before a real customer trial.

It must not implement new annotation/product semantics. It should make the existing app safe to package, deploy, validate and hand off.

---

## 2. Goal

Prepare SaPen Annotate for a real customer-facing single-host trial and manual iPad Safari validation.

At the end of RB-069:

1. Repository handoff archive creation is reproducible and excludes private/local artifacts.
2. Trial deployment docs are executable for the current Compose-based setup.
3. Manual iPad Safari gate is explicit, actionable and ready for real device execution.
4. Legacy storage helper duplication is removed or neutralized.
5. Asset download headers safely encode/sanitize filenames.
6. Final runbooks clearly state what is customer-trial-ready and what remains deferred.
7. All existing workflows and validation gates remain green.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- high availability,
- object replication,
- production monitoring stack,
- external identity provider,
- new annotation/domain features,
- model training orchestration,
- deployment to the real Strato server if credentials/access are unavailable,
- real iPad Safari execution if the deployed URL/device access is unavailable,
- exposing MinIO publicly,
- changing storage semantics,
- changing export/review/prediction rules.

If real deployment or iPad test cannot be executed, provide a ready-to-run gate and checklist, not a fake pass.

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
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

Work in focused slices and commit after each meaningful slice.

---

## 5. Handoff Archive Hygiene

### 5.1 Reproducible handoff command

Create a reproducible command/script for creating a handoff archive.

Possible names:

```bash
npm run handoff:archive
npm run repo:archive
scripts/create-handoff-archive.mjs
```

The command should produce a ZIP or tarball suitable for external review/deployment preparation.

### 5.2 Exclusion rules

The archive must exclude by default:

```text
.git/
.env
.env.*
!.env.example
!.env*.example
node_modules/
.next/
coverage/
test-results/
playwright-report/
*.tsbuildinfo
local storage/db volumes
tmp/cache directories
screenshots/traces/videos unless explicitly requested
developer-local logs
deploy/*.env
deploy/trial.env
minio data
postgres data
caddy data
backup output
```

### 5.3 Archive metadata

Include a generated handoff manifest where practical:

```text
handoff-manifest.json
```

Recommended fields:

- createdAt,
- git commit hash,
- git status clean/dirty,
- included root files,
- excluded patterns summary,
- app/package info.

If the worktree is dirty, the script should fail by default or require `--allow-dirty`.

---

## 6. Deployment Trial Runbook Finalization

Review and update:

```text
README.md
docs/04-server/deployment-trial.md
docs/04-server/backup-restore.md
docs/04-server/batch-prediction-imports.md
docs/04-server/storage-retention-cleanup.md
deploy/docker-compose.trial.yml
deploy/trial.env.example
```

Runbooks must cover:

- Linux host prerequisites,
- Docker/Compose,
- DNS/domain,
- ports/firewall,
- Caddy HTTPS,
- env/secrets,
- migrations,
- seed/named users,
- MinIO private storage,
- health/ready checks,
- optional worker profile,
- backup/restore,
- cleanup,
- restart/logs,
- known limits: no HA, no public MinIO, bounded batches.

---

## 7. iPad Safari Gate

Create or update:

```text
docs/07-testing/manual-smoke-ipad-safari-gate.md
```

The gate must be executable against a deployed URL and include:

- deployed URL,
- iPad model / iPadOS / Safari version,
- tester/date,
- named trial user,
- login,
- project navigation,
- image/editor open,
- semantic drawing,
- support mask,
- classification,
- review/export if role permits,
- assisted correction if fixture exists,
- finger drawing,
- Apple Pencil drawing if available,
- no scroll while drawing on canvas,
- page scroll outside canvas,
- portrait/landscape rotation,
- home-screen launch,
- pass/fail table,
- blocking vs non-blocking issue classification.

Docs must clearly state:

```text
Real iPad Safari Gate status: pending until deployed URL and device access are available.
```

If the real test is executed, record result; if not, do not mark it as passed.

---

## 8. Legacy Storage Helper Cleanup

Inspect `src/server/storage.ts`.

Search imports:

```bash
rg -n "server/storage(\.ts)?|from ['\"]@?/?.*server/storage" src tests scripts
```

Decide:

```text
delete if unused
or convert to re-export of active storage helper
or document why it remains
```

Preferred: delete if unused and tests pass.

Do not change actual storage behavior.

---

## 9. Content-Disposition Filename Hardening

Inspect all download routes setting `Content-Disposition`.

Tasks:

1. Find all Content-Disposition headers.
2. Add shared helper if useful, e.g.:

```text
src/server/http/contentDisposition.ts
```

3. Ensure filenames:
   - remove/escape CR/LF,
   - prevent header injection,
   - handle quotes,
   - provide ASCII fallback,
   - support UTF-8 `filename*` where practical.
4. Add focused tests.

Do not change file bytes or storage semantics.

---

## 10. Customer-Trial Readiness Summary

Create/update:

```text
docs/00-overview/customer-trial-readiness.md
```

It should summarize:

### Ready

- browser workflow,
- annotation/review/export,
- prediction workflow,
- batch import,
- cleanup/runbooks,
- handoff archive.

### Pending before actual customer pilot

- real server deployment,
- real iPad Safari gate,
- named customer users,
- backup verification,
- operator smoke run.

### Intentionally not included

- HA,
- enterprise IdP,
- public MinIO,
- production monitoring.

---

## 11. Tests

Add tests for:

- handoff archive exclusion matcher if implemented,
- dirty worktree behavior if script is testable,
- Content-Disposition helper,
- asset/download route header safety,
- export download filename safety,
- malicious filenames with CR/LF/quotes/UTF-8.

No real Strato deployment or real iPad required.

---

## 12. Documentation Updates

Update:

```text
README.md
ARCHITECTURE.md if needed
docs/00-overview/current-state.md
docs/00-overview/customer-trial-readiness.md
docs/04-server/deployment-trial.md
docs/04-server/backup-restore.md
docs/04-server/batch-prediction-imports.md
docs/04-server/storage-retention-cleanup.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
.env.example
```

Docs must distinguish:

- implemented and validated,
- ready but not executed due to missing deployment/device,
- intentionally deferred.

---

## 13. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. A reproducible handoff archive command or documented script exists.
3. Handoff archive excludes `.git`, env secrets, build outputs, caches, test artifacts and local volumes by default.
4. Handoff archive refuses dirty worktree by default or requires explicit opt-in.
5. Trial deployment runbook is current and copy-paste usable.
6. Real iPad Safari gate checklist is ready and clearly marked pending unless actually executed.
7. `src/server/storage.ts` legacy duplication is removed, neutralized or justified.
8. Content-Disposition filename handling is hardened and tested.
9. Customer trial readiness summary exists.
10. No annotation/domain/export/prediction semantics are changed.
11. Existing workflows remain green.
12. Ticket is moved to `tickets/2026-05-20/done/`.
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
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

14. If handoff command exists, dry-run command passes.
15. Final Codex report includes:
    - commits created,
    - handoff command/script behavior,
    - files/routes changed,
    - tests added/changed,
    - deployment/iPad gate status,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 14. Suggested Commit Sequence

```bash
git commit -m "docs: define customer trial handoff gate"
git commit -m "chore: add reproducible handoff archive command"
git commit -m "fix: harden download content disposition headers"
git commit -m "chore: clean up legacy storage helper"
git commit -m "docs: finalize deployment and ipad safari gate"
git commit -m "test: cover handoff and download header hygiene"
git commit -m "chore: finalize customer trial readiness ticket"
```

---

## 15. Notes for Codex

- This is the final trial-readiness gate, not a feature ticket.
- Do not pretend real iPad Safari passed unless actually executed.
- Do not include secrets or `.git` in handoff archives.
- Do not expose MinIO publicly.
- Prefer reproducible commands over prose-only instructions.

---

## Completion Notes

- Implemented reproducible `npm run handoff:archive` ZIP creation with clean-worktree enforcement and generated `handoff-manifest.json`.
- Hardened app-mediated image/export `Content-Disposition` headers with shared filename sanitization tests.
- Removed unused legacy `src/server/storage.ts` and updated storage docs to reference `src/server/storage/s3.ts`.
- Added `docs/04-server/deployment-trial.md`, `docs/00-overview/customer-trial-readiness.md`, and `docs/07-testing/manual-smoke-ipad-safari-gate.md`.
- Real iPad Safari validation remains pending until a deployed URL and device access are available.
