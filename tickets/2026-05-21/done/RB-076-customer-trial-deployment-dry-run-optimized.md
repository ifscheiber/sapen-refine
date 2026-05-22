# RB-076 — Customer Trial Deployment Dry Run

## Status

Implemented

## Priority

High

## Type

Operations / Deployment / Trial Readiness / Single-Host Compose / Smoke Test / Runbook Verification

## Repository

`sapen-annotate`

## Depends on

- RB-069 — Customer Trial Deployment, Handoff Hygiene & iPad Safari Gate
- RB-072 — Route-Level API Auth/Error Contract Hardening
- RB-073 — Trial Deployment Secret & Build-Context Hygiene
- RB-080 / RB-081 — Full-resolution mask upload hotfixes
- RB-075 — Dependency Audit / Prisma Version Policy, if already completed

## Blocks

- Real customer-facing trial access
- RB-077 — Real iPad Safari Trial Gate Execution
- Post-trial triage
- Larger product sprint: Crop-Based Slice Annotation Workflow

---

## 1. Context

RB-069 prepared the customer-trial handoff and deployment gate. RB-073 hardened Docker/Compose build-context and MinIO-init secret handling. RB-072 stabilized API error contracts. The current RB-076 draft correctly states that the real Strato/customer deployment has not yet been executed and that deployment should be rehearsed against the intended single-host Compose model before real customer access. The draft also correctly requires the current Compose architecture with Caddy, app, PostgreSQL, MinIO and optional worker profile, plus migrate deploy, named trial users, health/readiness checks, upload/editor/save/review/export, backup/restore outline and deviations from the runbook. 

RB-076 should now become the practical deployment rehearsal ticket.

This ticket should not start the new crop-based annotation sprint. The crop sprint is important, but RB-076 validates the current app as it exists today and may reveal deployment, resource, browser, upload or runbook blockers that should be fixed before larger feature work.

---

## 2. Goal

Perform and document a customer-trial deployment dry run using the current single-host Docker Compose runbook.

At the end of RB-076:

1. The trial deployment runbook has been executed on a clean host or equivalent clean local/VM dry-run environment.
2. The Compose stack starts successfully.
3. Database migration and seed/named-user creation are verified.
4. Health and readiness endpoints are verified.
5. A representative desktop browser smoke is executed against the deployed stack.
6. Backup and restore commands are verified or explicitly blocked with a documented reason.
7. Prediction worker, batch import processing, and storage cleanup operational commands are smoke-tested where feasible.
8. Any deviations or blockers become follow-up tickets.
9. No new product feature work is introduced.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- real iPad Safari gate execution unless deployed URL and device access are available,
- crop-based slice annotation workflow,
- new annotation/domain features,
- HA/replication/production monitoring,
- external identity provider,
- public MinIO exposure,
- Core integration,
- model inference execution,
- broad refactors,
- changes to training/export/review semantics.

If the dry run reveals a blocker, document it and create a focused hotfix ticket.

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
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

Then perform the deployment dry run.

Work in focused slices and commit after each meaningful documentation/fix slice.

---

## 5. Dry-Run Environment

### 5.1 Preferred environment

Use a clean single-host environment that resembles the intended Strato deployment as closely as practical:

```text
Linux host or clean VM
Docker + Docker Compose
No node_modules dependency outside containers
Fresh volumes
Fresh env file from deploy/trial.env.example
```

If a real Strato server is not available, use a clean local VM or clean local Docker environment and clearly document the limitation.

### 5.2 Freshness expectations

The dry run should not rely on previous local volumes unless explicitly testing upgrade behavior.

Preferred:

```bash
docker compose -f deploy/docker-compose.trial.yml down
docker volume ls
# use a clearly named dry-run project/compose project name
```

Do not delete unrelated developer data accidentally.

### 5.3 Environment file

Create a real dry-run env file from:

```text
deploy/trial.env.example
```

Do not commit the real env file.

Record which values must be changed without exposing secrets.

---

## 6. Deployment Steps to Verify

### 6.1 Build and start stack

Verify the current trial Compose model:

```text
caddy
app
postgres
minio
optional worker profile
```

Run and document commands:

```bash
docker compose --env-file <dry-run-env> -f deploy/docker-compose.trial.yml build
docker compose --env-file <dry-run-env> -f deploy/docker-compose.trial.yml up -d
docker compose --env-file <dry-run-env> -f deploy/docker-compose.trial.yml ps
```

If a different documented command is canonical, use it and update docs if needed.

### 6.2 Migration

Verify production-style migration:

```bash
docker compose --env-file <dry-run-env> -f deploy/docker-compose.trial.yml run --rm migrate
```

or the canonical project command.

Do not use `prisma migrate dev` for trial deployment.

### 6.3 Named trial users

Verify named-user creation/reset.

Use the documented command, for example:

```bash
npm run trial:user:create
```

or the Compose equivalent.

Requirements:

- no shared demo credentials by default,
- at least one OWNER/ADMIN user,
- at least one LABELER/ANNOTATOR if role model supports it,
- document exact commands and expected output,
- do not commit real passwords.

### 6.4 Health/readiness

Verify:

```text
/api/health
/api/ready
```

Record:

- status code,
- relevant response shape,
- whether DB/MinIO readiness passes.

### 6.5 Logs

Verify logs can be read:

```bash
docker compose logs app
docker compose logs caddy
docker compose logs postgres
docker compose logs minio
```

Do not paste secrets into docs.

---

## 7. Browser Smoke Against Deployed Stack

Execute a representative desktop browser smoke against the deployed URL or local trial URL.

Minimum workflow:

```text
login as named user
open project overview
open images route
upload image
open editor
draw small semantic mask
save/reload
draw support mask
set classification
submit/review/approve if same test role permits
create ground-truth export
download manifest/package if feasible
```

If prediction workflow fixtures are available, optionally test:

```text
create/import prediction
create correction task
open assisted correction
save human correction
prediction-analysis export
```

If too heavy for RB-076, document as optional and defer.

### 7.1 Full-resolution regression smoke

Because RB-080/RB-081 addressed large mask uploads, include a manual or automated check for the large-mask path if practical:

```text
upload/open image at or near 6000×4000
draw tiny stroke
save
confirm no MASK_BYTE_LENGTH_MISMATCH
```

If 8000×6000 is not tested, document that the upper bound remains policy/readiness, not executed evidence.

---

## 8. Worker / Batch / Cleanup Operational Smoke

Verify operational commands if feasible:

### 8.1 Worker profile config

Already checked at baseline, but also verify documented command:

```bash
docker compose --env-file <dry-run-env> -f deploy/docker-compose.trial.yml --profile worker config
```

Optionally start worker profile briefly if safe:

```bash
docker compose --env-file <dry-run-env> -f deploy/docker-compose.trial.yml --profile worker up -d prediction-worker
```

### 8.2 Batch processing command

Run a dry or no-op processing command if supported:

```bash
npm run jobs:prediction-import -- --dry-run
```

or Compose equivalent.

### 8.3 Storage cleanup dry run

Run:

```bash
npm run storage:cleanup -- --dry-run
```

or Compose equivalent.

Document output and safety expectations.

---

## 9. Backup and Restore Verification

### 9.1 Backup

Verify documented backup commands for:

```text
PostgreSQL
MinIO data
Caddy data/config
env/runbook artifacts
```

For dry run, it is acceptable to perform a backup of the dry-run dataset.

### 9.2 Restore outline or actual restore

Preferred:

- perform actual restore into fresh dry-run volumes if time allows.

Acceptable:

- verify backup command succeeds,
- document restore command as not executed with reason.

Do not claim restore is verified unless it was executed.

### 9.3 Evidence

Create/update a dry-run report:

```text
docs/04-server/trial-deployment-dry-run-YYYY-MM-DD.md
```

Record:

- environment,
- commands,
- outcomes,
- pass/fail,
- deviations,
- follow-up tickets.

Do not include secrets.

---

## 10. Handoff Archive Verification

Verify:

```bash
npm run handoff:archive -- --dry-run
```

Optionally generate a real handoff archive if needed for the dry run.

If generated, ensure:

- `.git` excluded,
- env secrets excluded,
- local volumes excluded,
- build/test artifacts excluded,
- manifest records git commit.

Do not commit generated archive unless the repo policy explicitly allows it.

---

## 11. Documentation Updates

Update:

```text
docs/04-server/deployment-trial.md
docs/04-server/backup-restore.md
docs/04-server/storage-retention-cleanup.md
docs/04-server/batch-prediction-imports.md
docs/00-overview/customer-trial-readiness.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/known-gaps.md
docs/adr/remediation-backlog.md
```

Add:

```text
docs/04-server/trial-deployment-dry-run-YYYY-MM-DD.md
```

Docs must distinguish:

```text
verified in dry run
documented but not executed
blocked, with reason
requires real Strato server
requires real iPad Safari
```

---

## 12. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Trial Compose stack can be built and started in clean dry-run environment or equivalent.
3. `migrate deploy` path is verified.
4. Named trial user creation/reset is verified.
5. `/api/health` and `/api/ready` pass.
6. Desktop browser smoke is executed against the deployed/dry-run stack.
7. Upload/editor/save/review/export path is verified or blocked with reason.
8. Large-mask save regression is tested or explicitly documented as not executed.
9. Backup command is verified.
10. Restore is either verified or explicitly documented as not executed with reason.
11. Worker/batch/cleanup operational commands are smoke-tested or explicitly documented as not executed with reason.
12. Deviations from runbook are documented.
13. Follow-up tickets are created for findings.
14. No new product features are introduced.
15. Ticket is moved to:

```text
tickets/2026-05-21/done/
```

16. Final validation passes:

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

17. Final Codex report includes:
    - commits created,
    - dry-run environment,
    - commands executed,
    - pass/fail status,
    - deployment deviations,
    - backup/restore status,
    - health/readiness status,
    - smoke-test result,
    - follow-up tickets.

---

## 13. Suggested Commit Sequence

```bash
git commit -m "docs: define customer trial deployment dry run"
git commit -m "docs: record trial deployment dry run results"
git commit -m "docs: update deployment runbook from dry run"
git commit -m "chore: finalize customer trial deployment dry run ticket"
```

If a small runbook/script correction is required, add a focused commit.

---

## 14. Notes for Codex

- This is an operations validation ticket.
- Do not implement new product features.
- Do not claim real iPad Safari passed unless executed.
- Do not commit secrets or real env files.
- Convert findings into focused follow-up tickets.
