# RB-065 — Batch Job Runner Hardening

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Operations / Background Jobs / Prediction Import / Reliability / Audit / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-061 — Batch Prediction Import & Background Job Baseline
- RB-062 — Repository State & Documentation Consistency Sweep
- RB-064 — Auth, RBAC & Audit Hardening

## Blocks

- RB-066 — Batch/Staging Storage Retention & Cleanup
- Reliable customer-trial batch prediction imports
- Future production-grade job infrastructure

---

## 1. Context

RB-061 introduced DB-backed batch prediction import:

- `PredictionImportBatchJob`
- `PredictionImportBatchItem`
- batch/job status models
- ZIP manifest batch import
- APIs for create/list/detail/items/process/retry
- optional operational script `npm run jobs:prediction-import`
- item-level failure and retry bookkeeping
- idempotent processing that does not duplicate succeeded prediction artifacts.

RB-064 hardened auth/RBAC/audit and added a central policy layer, login hardening, same-origin mutation guard, session throttling, and broader audit coverage.

The remaining operational risk is that batch processing is still not fully hardened for a single-host customer trial:

- processing is explicit through UI/API/script calls,
- `PROCESSING` items need stale recovery if a process dies,
- processor identity must be clear and attributable,
- Compose/cron/systemd usage must be documented,
- processing should not rely on a browser tab.

This ticket implements a reliable **single-host runner baseline** without introducing distributed queue infrastructure.

---

## 2. Goal

Make batch prediction import processing safe and operable for the single-host Strato-style trial setup.

At the end of RB-065:

1. Operators can process batch imports without relying on an open browser tab.
2. The chosen runner model is documented and copy-paste runnable.
3. `PROCESSING` items have stale recovery rules.
4. Item claiming/processing has lease or heartbeat semantics sufficient for a single-host trial.
5. Processor identity is represented in audit/logs.
6. Reprocessing remains idempotent and never duplicates succeeded prediction artifacts.
7. RB-061 batch APIs/UI continue to work.
8. Existing prediction/import/correction/export workflows remain green.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- Kubernetes,
- Redis/RabbitMQ/BullMQ or distributed queue infrastructure,
- HA workers,
- model inference,
- changing prediction import validation semantics,
- automatic correction task creation beyond existing RB-058 behavior,
- changing ground-truth/export rules,
- storage retention cleanup for staged batch files; this belongs to RB-066,
- UI redesign of batch import pages,
- replacing the existing DB-backed model.

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

## 5. Runner Architecture

### 5.1 Choose one primary trial runner path

Codex must choose and document the primary single-host runner path.

Recommended options:

#### Option A — Docker Compose worker service

A dedicated Compose service runs a loop or one-shot command:

```text
app-worker
→ npm run jobs:prediction-import -- --loop --interval 30
```

Good for the current single-host Docker Compose deployment.

#### Option B — systemd timer

A systemd timer runs:

```text
npm run jobs:prediction-import -- --limit 100
```

Good if the app is deployed as a host-managed Node process.

#### Option C — cron

Cron runs a bounded processing command.

Simplest but less expressive for logs/status.

Preferred for the current Strato/Compose trial: **Option A** unless the current deployment docs make another option clearly better.

### 5.2 Keep processing bounded

Runner must not process infinite unbounded work per tick unless intentionally in a loop mode with a safe interval.

Configurable limits:

- batch id optional,
- max jobs per tick,
- max items per tick,
- sleep interval if loop mode,
- stale processing timeout,
- max attempts.

---

## 6. Lease / Heartbeat / Stale Recovery

### 6.1 Required behavior

Implement stale recovery for `PROCESSING` items.

Minimum model:

```text
PROCESSING item has startedAt / updatedAt / leaseExpiresAt or equivalent
If now > leaseExpiresAt, item can be marked RETRY_PENDING or FAILED depending on attempt count
```

If schema lacks lease fields, add a minimal migration, or use existing timestamps if safe and well-documented.

### 6.2 Suggested item fields

If missing, add minimal fields:

```text
leasedBy
leaseExpiresAt
lastHeartbeatAt
processorRunId
```

If these are too much, at minimum use:

```text
startedAt + configured staleAfterMs
```

and document limitations.

### 6.3 Recovery rules

Recommended:

- `PROCESSING` item with expired lease and attempts remaining → `RETRY_PENDING`
- `PROCESSING` item with expired lease and no attempts remaining → `FAILED`
- record stable error code, e.g. `BATCH_ITEM_STALE_PROCESSING_RECOVERED`
- update batch counts
- write audit/log entry if audit infrastructure supports it.

---

## 7. Processor Identity & Audit

### 7.1 Processor identity

Define how processing is attributed.

Recommended for single-host trial:

- use initiating user for batch ownership,
- use configured processor identity in metadata for job execution,
- if a system user exists or is created, use it consistently.

Possible config:

```env
SAPEN_SYSTEM_ACTOR_EMAIL=system@sapen.local
PREDICTION_IMPORT_PROCESSOR_ID=sapen-annotate-worker
```

Do not store secrets.

### 7.2 Audit actions

Add or verify audit entries for:

```text
PREDICTION_BATCH_PROCESS_STARTED
PREDICTION_BATCH_PROCESS_COMPLETED
PREDICTION_BATCH_ITEM_CLAIMED
PREDICTION_BATCH_ITEM_SUCCEEDED
PREDICTION_BATCH_ITEM_FAILED
PREDICTION_BATCH_ITEM_RETRY_SCHEDULED
PREDICTION_BATCH_STALE_RECOVERED
PREDICTION_BATCH_RETRY_REQUESTED
```

Exact action names may follow existing conventions.

Logs/audit must not include secrets, raw credentials, session tokens or private storage URLs.

---

## 8. API / Script / Compose Scope

### 8.1 Processing script

Harden or add script:

```bash
npm run jobs:prediction-import
```

Recommended options:

```text
--batch <id>
--limit <n>
--max-jobs <n>
--recover-stale
--loop
--interval <seconds>
--dry-run
```

Do not overbuild. Implement options that are useful and testable.

### 8.2 Compose worker

If Option A is selected, update deployment artifacts:

```text
deploy/docker-compose.trial.yml
```

Add optional worker service/profile, for example:

```yaml
profiles:
  - worker
```

or document a one-shot command:

```bash
docker compose -f deploy/docker-compose.trial.yml run --rm app npm run jobs:prediction-import -- --limit 100
```

Do not make an always-on worker mandatory if it complicates the trial.

### 8.3 API processing route

Existing process route may remain.

Harden it to use the same processor/lease logic.

Rules:

- no browser tab dependency for normal operation,
- UI-triggered processing is still allowed for manual trial use,
- API respects RBAC/policies from RB-064,
- same-origin guard remains compatible.

---

## 9. Tests

### 9.1 Unit/domain tests

Cover:

- stale item detection,
- lease expiration,
- item claim eligibility,
- batch count aggregation,
- retry eligibility,
- processor summary formatting.

### 9.2 Integration tests

Cover:

- process command/service claims pending items,
- processing success updates item and batch status,
- stale `PROCESSING` item recovers to retry/fail,
- repeated processing does not duplicate successful prediction artifacts,
- unauthorized user cannot trigger API processing,
- worker/system processing records processor identity/audit,
- failed items retain stable error codes.

Existing E2E must remain green. No new browser E2E is required unless a stable UI path already exists.

---

## 10. Documentation Updates

Update:

```text
docs/04-server/batch-prediction-imports.md
docs/04-server/deployment-trial.md
docs/04-server/backup-restore.md
docs/04-server/auth-rbac-audit.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
.env.example
deploy/docker-compose.trial.yml
```

Docs must include:

- chosen runner model,
- copy-paste commands,
- normal processing flow,
- retry flow,
- stale recovery behavior,
- processor identity,
- logs/audit behavior,
- known limits,
- relationship to RB-066 retention cleanup.

---

## 11. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. A primary single-host runner path is chosen and documented.
3. Operators can process prediction batches without relying on an open browser tab.
4. Stale `PROCESSING` items can recover deterministically.
5. Lease/heartbeat/stale timeout behavior is implemented or explicitly bounded and documented.
6. Repeated processing does not duplicate succeeded prediction artifacts.
7. Processor identity is recorded in logs/audit/metadata where practical.
8. UI/API-triggered processing continues to work if previously supported.
9. RBAC/policy checks still protect manual process/retry endpoints.
10. Tests cover stale recovery and idempotent processing.
11. Deployment/runbook docs include copy-paste commands.
12. No model inference or distributed queue infrastructure is introduced.
13. Existing import/queue/correction/export workflows remain green.
14. Ticket is moved to:

```text
tickets/2026-05-20/done/
```

15. Final validation passes:

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

16. Final Codex report includes:
    - commits created,
    - runner model chosen,
    - schema changes if any,
    - scripts/compose/docs changed,
    - tests added/changed,
    - stale recovery behavior,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 12. Suggested Commit Sequence

```bash
git commit -m "docs: define batch runner hardening plan"
git commit -m "feat: add batch processing lease recovery"
git commit -m "feat: harden prediction import job runner"
git commit -m "chore: document compose worker run path"
git commit -m "test: cover batch runner stale recovery"
git commit -m "docs: document batch runner operations"
git commit -m "chore: finalize batch runner hardening ticket"
```

---

## 13. Notes for Codex

- Keep it single-host and simple.
- Prefer DB-backed deterministic recovery over new queue infrastructure.
- Do not run inference.
- Do not change prediction import validation semantics.
- RB-066 will handle staged object retention/cleanup.
