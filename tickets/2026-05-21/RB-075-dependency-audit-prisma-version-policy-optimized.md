# RB-075 — Dependency Audit / Prisma Version Policy

## Status

Proposed / Ready for Codex

## Priority

Medium / High

## Type

Dependency Hygiene / Security / Prisma / Trial Readiness / Documentation / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-071 — Architecture / Docs / Backlog Consistency Hotfix
- RB-072 — Route-Level API Auth/Error Contract Hardening
- RB-073 — Trial Deployment Secret & Build-Context Hygiene
- RB-074 — Client API Wrapper / Presign Compatibility Cleanup

## Blocks

- Customer-trial dependency risk sign-off
- External handoff confidence
- Future dependency upgrade policy

---

## 1. Context

The dependency audit baseline is much improved, but the review still found a known moderate Prisma CLI advisory chain involving:

```text
prisma
@prisma/dev
@hono/node-server
```

The existing RB-075 draft correctly states that this should be handled as a dedicated dependency decision, because the npm recommendation may imply a semver-major or otherwise risky Prisma change. It explicitly says not to run `npm audit fix --force` blindly and to document accepted risk if deferred.

RB-075 should produce a clear, trial-ready dependency decision:

```text
fixed
or
accepted/deferred with rationale
```

This ticket is not a broad dependency modernization ticket.

---

## 2. Goal

Resolve or explicitly document the Prisma CLI audit risk before customer-trial handoff.

At the end of RB-075:

1. `npm audit --json` has been re-run and summarized.
2. Current `prisma` / `@prisma/client` versions are inspected.
3. A decision is made:
   - targeted upgrade,
   - pin/override,
   - downgrade if justified,
   - or defer/accept risk with clear rationale.
4. Prisma generate, migration/deploy expectations, build, tests and E2E remain green.
5. Docs/backlog record the dependency policy and remaining risk, if any.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- broad dependency upgrade spree,
- framework migration,
- Next.js major migration,
- React migration,
- Prisma schema semantic changes,
- database model changes,
- switching ORM,
- `npm audit fix --force`,
- accepting lockfile churn without clear reason,
- changing product behavior.

If broad upgrades are needed, create a separate planned dependency upgrade ticket.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Start with the full validation baseline and audit:

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
npm audit --json
npm ls prisma @prisma/client
```

Work in focused slices and commit after each meaningful slice.

If external internet access is unavailable, document that limitation and rely on local `npm audit` / lockfile data. Do not invent vulnerability facts.

---

## 5. Audit Review Scope

### 5.1 Capture current audit

Create/update a concise audit note.

Suggested file:

```text
docs/04-server/dependency-audit.md
```

or update an existing dependency/security doc.

Record:

- date,
- commands run,
- advisory package(s),
- severity,
- direct vs transitive dependency,
- affected path,
- current installed versions,
- npm recommendation,
- whether recommendation is semver-major,
- trial impact,
- decision.

Do not paste huge raw audit JSON into docs; summarize and keep raw command reproducible.

### 5.2 Inspect package files

Inspect:

```text
package.json
package-lock.json
```

Identify:

- `prisma` version,
- `@prisma/client` version,
- whether versions are aligned,
- dependency path to advisory,
- whether lockfile update is needed.

### 5.3 Trial risk assessment

Assess whether the advisory affects:

```text
runtime app container
development/CLI only
build-time only
migration/deploy commands
customer-exposed HTTP surface
```

If the vulnerable chain is CLI-only and not reachable in runtime, document that clearly.

If it affects runtime server code, treat as higher priority.

---

## 6. Decision Options

Codex must choose one and document rationale.

### Option A — Targeted safe upgrade

Use if a non-breaking patch/minor upgrade fixes the advisory.

Rules:

- keep `prisma` and `@prisma/client` aligned,
- update lockfile,
- run full validation,
- update docs.

### Option B — Pin / override

Use if a transitive vulnerable package can be overridden safely without a major Prisma upgrade.

Rules:

- use package-manager-supported override mechanism,
- explain why override is safe,
- run full validation,
- document how to revisit.

### Option C — Defer / accept risk

Use if fixing requires risky semver-major upgrade or breaks validation.

Required documentation:

- why not fixed now,
- whether advisory is CLI/build-time/runtime,
- trial exposure assessment,
- mitigation,
- follow-up trigger,
- target future version/ticket.

### Option D — Planned major upgrade follow-up

Use if a major Prisma upgrade is needed.

Create a follow-up ticket with:

- upgrade target,
- migration notes,
- expected breakage,
- validation plan,
- rollback plan.

---

## 7. Implementation Rules

### 7.1 No blind audit fix

Forbidden:

```bash
npm audit fix --force
```

Allowed only with explicit user approval in a separate decision, not inside RB-075.

### 7.2 Keep Prisma versions aligned

If upgrading:

```text
prisma and @prisma/client should remain compatible/aligned
```

Run:

```bash
npm run prisma:generate
npm run db:rebuild
```

### 7.3 Minimize lockfile churn

Avoid broad lockfile churn unrelated to the advisory.

If lockfile churn is unavoidable, explain why.

### 7.4 Validate migrations/deploy path

Because the app uses Prisma migrations and trial deploy:

```bash
npx prisma migrate deploy
```

or the repo’s canonical deploy command should remain valid if practical.

If `db:rebuild` covers migration application, document that.

---

## 8. Tests / Validation

### 8.1 Required checks

Final validation must include:

```bash
git status --short
npm audit --json
npm ls prisma @prisma/client
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

If the audit still reports findings, the final report must say whether they are accepted/deferred and where documented.

### 8.2 No new app tests expected

No new runtime tests are required unless code/config changes require them.

If dependency changes break tests, fix narrowly or revert and document deferral.

---

## 9. Documentation Updates

Update:

```text
docs/04-server/dependency-audit.md
docs/04-server/deployment-trial.md
docs/00-overview/customer-trial-readiness.md
docs/adr/remediation-backlog.md
docs/known-gaps.md
README.md if relevant
```

Docs must state:

- current dependency audit result,
- Prisma CLI/client version policy,
- whether advisory is fixed or accepted/deferred,
- trial risk assessment,
- follow-up ticket if needed,
- do not use `npm audit fix --force`.

---

## 10. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. `npm audit --json` has been run and summarized.
3. `npm ls prisma @prisma/client` has been run and summarized.
4. Prisma CLI/client version relationship is documented.
5. The Prisma advisory is either fixed or explicitly accepted/deferred with rationale.
6. No blind `npm audit fix --force` is used.
7. Any dependency/lockfile changes are targeted and explained.
8. Prisma generate and DB rebuild remain green.
9. Full validation gate remains green unless an accepted audit-only finding remains.
10. Customer-trial readiness docs reflect dependency risk status.
11. Ticket is moved to:

```text
tickets/2026-05-21/done/
```

12. Final Codex report includes:
    - commits created,
    - audit summary,
    - Prisma versions,
    - decision made,
    - dependency/lockfile changes if any,
    - validation commands run,
    - pass/fail status,
    - remaining accepted risks/follow-up tickets.

---

## 11. Suggested Commit Sequence

```bash
git commit -m "docs: record prisma dependency audit baseline"
git commit -m "chore: apply targeted prisma dependency policy"
git commit -m "docs: document dependency audit decision"
git commit -m "chore: finalize dependency audit ticket"
```

If no dependency change is made, use docs-focused commits only.

---

## 12. Notes for Codex

- This is a decision/hygiene ticket.
- Do not perform broad upgrades.
- Do not force audit fixes.
- Prefer safe targeted fix or explicit documented deferral.
- Keep all product behavior unchanged.
