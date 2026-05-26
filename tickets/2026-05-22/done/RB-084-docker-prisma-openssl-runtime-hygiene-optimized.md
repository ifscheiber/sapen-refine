# RB-084 — Docker Prisma OpenSSL Runtime Hygiene

## Status

Implemented

## Priority

Medium / High

## Type

Deployment / Docker / Prisma Runtime Hygiene / Trial Readiness / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-073 — Trial Deployment Secret & Build-Context Hygiene
- RB-075 — Dependency Audit / Prisma Version Policy
- RB-076 — Customer Trial Deployment Dry Run, if already started/executed

## Blocks

- Clean customer-trial Docker image
- Customer-trial deployment confidence
- Future Strato deployment dry run without noisy Prisma runtime warnings

---

## 1. Context

The local trial deployment dry run built and ran the Compose app/migrate images successfully, but Prisma emitted warnings inside the `node:22-bookworm-slim` image:

```text
Prisma failed to detect the libssl/openssl version to use, and may not work as expected.
Defaulting to "openssl-1.1.x".
```

The warning appeared during Docker image build and during the `migrate` one-shot service.

The commands passed, but a customer-trial image should not rely on Prisma fallback detection. The trial Docker image should include the OpenSSL runtime dependency that Prisma expects to detect.

This ticket is a narrow Docker runtime hygiene ticket. It must not change Prisma versions or application behavior.

---

## 2. Goal

Ensure Prisma no longer emits OpenSSL/libssl detection warnings inside the Docker image stages used for:

- Prisma generation,
- migration / `migrate deploy`,
- runtime scripts,
- app runtime,
- optional worker scripts if they use Prisma.

At the end of RB-084:

1. Docker build completes without Prisma OpenSSL detection warnings.
2. Migrate one-shot service runs without Prisma OpenSSL detection warning.
3. The app/runtime image still works.
4. The optional worker profile still validates.
5. No Prisma version changes are introduced.
6. No Compose topology changes are introduced.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- Prisma version upgrades/downgrades,
- `npm audit fix --force`,
- dependency policy changes,
- schema changes,
- migration semantic changes,
- Compose topology redesign,
- high availability,
- image-size optimization unrelated to OpenSSL,
- switching base image unless strictly necessary,
- unrelated Docker cleanup.

If a broader base-image decision is needed, create a follow-up ticket.

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

Because this ticket is Docker-focused, also run Docker build/migrate checks before and after changes if practical.

Work in focused commits.

---

## 5. Implementation Scope

### 5.1 Inspect Dockerfile stages

Inspect:

```text
Dockerfile
deploy/docker-compose.trial.yml
deploy/trial.env.example
docs/04-server/deployment-trial.md
```

Identify which stages/services run Prisma:

```text
npm run prisma:generate
npx prisma generate
npx prisma migrate deploy
migrate Compose service
app runtime
worker/script runtime
```

The OpenSSL runtime dependency must be present in every image stage where Prisma needs to run.

### 5.2 Install OpenSSL runtime dependency

For Debian Bookworm slim images, prefer installing `openssl` via apt:

```Dockerfile
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
```

Important:

- Do **not** install historical `libssl1.1` as a workaround.
- Do **not** change Prisma versions.
- Do **not** use broad package installs if `openssl` is sufficient.
- If Prisma still warns, verify the package is installed in the correct stage.

### 5.3 Avoid unrelated image churn

Keep the change minimal.

Do not introduce unrelated Docker optimization, image-size restructuring, multi-stage rewrite, or base-image switch unless the current image cannot support the fix.

### 5.4 Worker/migrate coverage

Ensure the fix applies to:

- app image,
- migrate/tools service image,
- optional worker profile image if it reuses or builds from a different stage.

If all services use the same final image, document that.

---

## 6. Validation Requirements

### 6.1 Docker build

Run:

```bash
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml build
```

Expected:

```text
Build passes.
No Prisma OpenSSL detection warning appears during build/prisma generate.
```

### 6.2 Migrate service

Run the migration service using trial Compose.

Preferred if tools profile is used:

```bash
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile tools run --rm migrate
```

or the repo's documented equivalent.

Expected:

```text
Migrate command passes.
No Prisma OpenSSL detection warning appears.
```

### 6.3 Runtime smoke

If practical, run a lightweight Prisma runtime smoke inside the app image:

```bash
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml run --rm app node -e "require('@prisma/client')"
```

or an equivalent documented smoke.

Do not overbuild if the app image command makes this awkward; document the chosen smoke.

### 6.4 Compose config

Run:

```bash
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

### 6.5 Standard app validation

Final gate:

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
```

---

## 7. Documentation Updates

Update only if the Docker runtime assumption changes:

```text
docs/04-server/deployment-trial.md
docs/00-overview/customer-trial-readiness.md
docs/known-gaps.md
docs/adr/remediation-backlog.md
```

Docs should state:

- Docker image includes OpenSSL for Prisma runtime/generate/migrate compatibility.
- This is a Docker runtime dependency, not a Prisma version change.
- No external system package installation is required on the host beyond Docker/Compose.

---

## 8. Tests

No new application behavior tests are expected.

Add/update a lightweight static deployment hygiene test only if the repo already has a suitable pattern, for example:

- Dockerfile includes OpenSSL install,
- Dockerfile does not use `libssl1.1`,
- deployment docs mention Prisma/OpenSSL assumption.

Do not add brittle Dockerfile snapshot tests.

---

## 9. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Docker build passes.
3. Prisma OpenSSL detection warning no longer appears during Docker build/prisma generate.
4. Migrate one-shot service passes without the OpenSSL detection warning.
5. Optional worker profile Compose config remains valid.
6. Prisma versions are unchanged.
7. Compose topology is unchanged.
8. No unrelated Docker/image optimization is introduced.
9. Standard app validation remains green.
10. Deployment docs are updated if needed.
11. Ticket is moved to:

```text
tickets/2026-05-22/done/
```

12. Final Codex report includes:
    - commits created,
    - Dockerfile changes,
    - whether OpenSSL warning disappeared,
    - Docker build/migrate commands run,
    - standard validation commands run,
    - pass/fail status,
    - remaining limitations if any.

---

## 10. Suggested Commit Sequence

```bash
git commit -m "chore: add openssl runtime for prisma docker image"
git commit -m "docs: document prisma openssl docker assumption"
git commit -m "chore: finalize prisma openssl runtime ticket"
```

If documentation changes are unnecessary, keep the commit sequence minimal.

---

## 11. Notes for Codex

- This is a narrow Docker runtime hygiene ticket.
- Do not change Prisma package versions.
- Do not install `libssl1.1`.
- Do not run `npm audit fix --force`.
- Do not change Compose topology.
- The success signal is absence of Prisma OpenSSL detection warnings in build/migrate output.
