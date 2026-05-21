# RB-073 — Trial Deployment Secret & Build-Context Hygiene

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Deployment / Security / Docker / Compose / Customer Trial Readiness / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-069 — Customer Trial Deployment, Handoff Hygiene & iPad Safari Gate
- RB-071 — Architecture / Docs / Backlog Consistency Hotfix
- RB-072 — Route-Level API Auth/Error Contract Hardening

## Blocks

- Real customer-facing Strato trial deployment
- Customer handoff confidence
- RB-070 — Editor Eraser Tool UX, if deployment hygiene is prioritized first

---

## 1. Context

RB-069 added handoff/deployment hygiene and a reproducible handoff archive. RB-072 hardened API error contracts and ran the full trial validation gate.

The post-review found two concrete deployment hygiene gaps:

1. `.dockerignore` does not exclude all generated/local/private artifacts that should not enter Docker build context.
2. `deploy/docker-compose.trial.yml` interpolates MinIO credentials in the `minio-init` command, which can expose real values in rendered Compose config or process metadata.

The original RB-073 draft correctly scopes this as a deployment/security hygiene ticket: align `.dockerignore` with handoff exclusions, avoid rendering MinIO credentials directly in Compose command output, keep MinIO private, update the trial runbook, and validate Compose config.

RB-073 must not deploy to Strato and must not introduce HA, monitoring, or external secret management.

---

## 2. Goal

Harden the Docker/Compose customer-trial baseline so local artifacts and credentials are less likely to leak during builds, config rendering, or operations.

At the end of RB-073:

1. Docker build context excludes generated/private/local artifacts.
2. Compose config no longer renders MinIO access credentials directly in the `minio-init` command.
3. Trial deployment docs explain the safer secret/build-context model.
4. MinIO remains private.
5. Full validation and Compose config checks remain green.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- real Strato deployment,
- high availability,
- object replication,
- production monitoring,
- external secret manager,
- Kubernetes,
- public MinIO exposure,
- changing application auth/session behavior,
- changing app storage semantics,
- changing backup/restore behavior beyond docs,
- product feature work.

If a future production secret manager is needed, add a backlog entry.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Start with the full validation baseline:

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

Work in focused slices and commit after each meaningful slice.

---

## 5. Docker Build Context Hygiene

### 5.1 Review current `.dockerignore`

Compare `.dockerignore` with handoff archive exclusions from RB-069.

Ensure Docker build context excludes at least:

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
*.zip
*.tar
*.tgz
*.tar.gz
backups/
backup/
tmp/
cache/
.caddy/
minio/
postgres/
storage/
screenshots/
traces/
videos/
*.log
```

Adjust exact entries to the repository’s existing folders.

### 5.2 Do not exclude required build files

Ensure the Docker build still includes required files:

```text
package.json
package-lock.json
prisma/
src/
public/
next.config.*
tsconfig.json
tailwind/postcss config if used
```

Do not accidentally exclude migration files, Prisma schema, public icons/manifest, or deployment Dockerfile.

### 5.3 Optional build-context check

If practical, add a lightweight script/check that prints or validates important `.dockerignore` patterns.

Do not overbuild.

---

## 6. Compose Secret Hygiene

### 6.1 Problem

The current `minio-init` command may interpolate variables such as MinIO root user/password directly into rendered Compose output or process metadata.

This can expose credentials through:

```bash
docker compose config
docker inspect
process command lines
logs / debugging output
```

### 6.2 Required behavior

Refactor `deploy/docker-compose.trial.yml` so MinIO credentials are not embedded directly in the Compose `command` string if avoidable.

Preferred approaches:

#### Option A — Use an init script inside the container

Mount or include a small script such as:

```text
deploy/minio-init.sh
```

The Compose command calls the script, and the script reads credentials from environment variables internally.

Example concept:

```yaml
command: ["/bin/sh", "/scripts/minio-init.sh"]
```

The script should avoid echoing secrets.

#### Option B — Use shell with env reads but not interpolated values

If a script is not practical, keep credentials as runtime env reads and avoid rendering them in the Compose command.

Codex should choose the simplest safe option.

### 6.3 Validation

After change:

```bash
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

Inspect rendered config to ensure real secret values are not directly present in the MinIO init command.

With example values, the config may still show environment variable names or example env entries. With a real `deploy/trial.env`, Compose can still render secret values in service `environment` blocks; do not share real rendered config output. The key RB-073 issue is avoiding direct credentials in MinIO init command/entrypoint strings and process metadata.

### 6.4 MinIO remains private

Do not expose MinIO S3 or console publicly.

Caddy/public traffic must continue to reach the app only.

---

## 7. Trial Runbook Updates

Update:

```text
docs/04-server/deployment-trial.md
docs/04-server/backup-restore.md
docs/04-server/storage-retention-cleanup.md
README.md if needed
.env.example
deploy/trial.env.example
```

Docs must explain:

- Docker build context hygiene,
- what `.dockerignore` excludes,
- where real secrets belong,
- that `trial.env.example` is not a secret file,
- how to create the real env file,
- why `docker compose config` should not be shared with real secrets,
- MinIO remains private,
- how to run Compose config checks safely,
- no HA/monitoring assumptions.

---

## 8. Tests / Checks

### 8.1 Static checks

Add/update tests only if useful.

Possible checks:

- `.dockerignore` contains required patterns,
- `deploy/docker-compose.trial.yml` does not interpolate MinIO credentials in command,
- minio-init script exists and does not echo secrets.

This can be a small unit/static test if repo conventions allow.

### 8.2 Compose checks

Required final checks:

```bash
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

### 8.3 Existing validation

All existing gates must remain green.

---

## 9. Documentation Updates

Update:

```text
docs/04-server/deployment-trial.md
docs/04-server/backup-restore.md
docs/04-server/storage-retention-cleanup.md
docs/00-overview/customer-trial-readiness.md
docs/adr/remediation-backlog.md
docs/known-gaps.md
README.md if needed
.env.example
deploy/trial.env.example
```

Docs must state:

- this is single-host trial hygiene,
- not production-grade secret management,
- no public MinIO,
- no external secret manager yet,
- remaining deployment risks if any.

---

## 10. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. `.dockerignore` excludes expected generated/private/local artifacts.
3. Required build inputs are not excluded.
4. MinIO credentials are not rendered directly in the Compose init command.
5. MinIO remains private.
6. Trial deployment docs explain build-context and secret-handling behavior.
7. Compose config checks pass for normal and worker profiles.
8. Handoff archive dry-run still passes.
9. No application behavior/product semantics are changed.
10. Ticket is moved to:

```text
tickets/2026-05-21/done/
```

11. Final validation passes:

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

12. Final Codex report includes:
    - commits created,
    - `.dockerignore` changes,
    - Compose/minio-init changes,
    - docs changed,
    - validation commands run,
    - pass/fail status,
    - remaining limitations/backlog entries.

---

## 11. Suggested Commit Sequence

```bash
git commit -m "docs: define trial deployment hygiene scope"
git commit -m "chore: harden docker build context exclusions"
git commit -m "chore: avoid minio credential interpolation in compose init"
git commit -m "docs: update trial deployment secret handling"
git commit -m "test: cover deployment hygiene checks"
git commit -m "chore: finalize trial deployment hygiene ticket"
```

---

## 12. Notes for Codex

- This is deployment hygiene, not infrastructure redesign.
- Do not add public MinIO exposure.
- Do not introduce external secret managers.
- Keep the single-host Compose model.
- Preserve all app behavior and validation gates.
