# RB-046 — Customer Browser Deployment & Trial Readiness Baseline

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Deployment / Browser Trial Readiness / Runtime Configuration / PWA Baseline

## Repository

`sapen-annotate`

## Depends on

- RB-040 — Rename + Repo-Hygiene Baseline
- RB-041 — Green Validation Baseline and Test Harness
- RB-042 — Dependency Audit Baseline
- RB-043 — Architecture & UI Baseline Before Domain Expansion
- RB-044 — Restore Login DB Bootstrap Baseline
- RB-045 — Editor / iPad Readiness & Manual Smoke Baseline

## Blocks

- Customer-facing browser trial
- Real iPad smoke execution by customer/internal tester
- Annotation domain model implementation
- Admin training export
- Model-assisted preprediction / correction workflow

---

## 1. Context

RB-045 made the editor substantially more suitable for browser and iPad usage:

- editor hook warnings were removed,
- Pointer Events handling for mouse/touch/stylus was hardened,
- canvas coordinate helpers and unit tests were added,
- dirty/saving state and unsaved-change protection were added,
- larger iPad touch targets were introduced,
- a manual desktop/iPad smoke checklist was documented.

The final validation baseline is green:

```bash
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run check:design-hardcoding
```

Remaining relevant facts from RB-045:

- `npm run build` passes but still reports the known `middleware -> proxy` warning.
- Manual iPad smoke is documented but was not executed by Codex on a real iPad.
- Follow-up backlog entries exist for advanced iPad zoom/pan and future automated browser smoke.

The next step should therefore not be domain expansion yet. The app must first become reliably deployable and testable in a customer-facing browser environment.

This ticket establishes a minimal but production-shaped browser deployment baseline for a controlled customer trial.

---

## 2. Goal

Make SaPen Annotate deployable and operable as a browser-based customer trial application.

At the end of this ticket, a developer/operator should be able to:

1. configure the app from `.env`,
2. prepare the database,
3. run the app in production mode,
4. place it behind an HTTPS reverse proxy,
5. verify health/readiness,
6. open it from desktop and iPad Safari,
7. optionally add it to the iPad Home Screen,
8. run a documented customer-trial smoke checklist.

The goal is **deployment readiness**, not feature expansion.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- new annotation domain schema,
- T-number/specimen/slice/acquisition metadata model,
- admin export/download,
- model preprediction or active-learning ranking,
- Core handoff/correction workflow,
- full editor redesign,
- advanced iPad zoom/pan gesture system,
- full Playwright/E2E suite,
- offline-first/service-worker caching,
- multi-tenant customer administration,
- Kubernetes/complex infrastructure,
- full observability stack.

If discovered, add precise backlog entries instead of expanding scope.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Mandatory process:

1. Start with:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run check:design-hardcoding
```

2. Record the current baseline in docs before making changes.
3. Work in meaningful slices.
4. At the end of each slice:
   - run relevant checks,
   - update docs,
   - create a detailed focused Git commit.
5. Do not mix unrelated completed slices in one commit.
6. Keep the app deployable/runnable after every meaningful slice.

---

## 5. Scope

### 5.1 Deployment baseline audit

Inspect the current runtime/deployment-related code and docs.

Review at minimum:

```text
package.json
next.config.*
middleware.ts / proxy.ts if present
prisma/schema.prisma
prisma.config.*
.env.example
README.md
ARCHITECTURE.md
AGENTS.md
docs/**
src/server/**
src/app/api/**
src/app/**/layout.tsx
src/app/**/manifest.* if present
public/**
```

Document:

- current dev start path,
- current production build/start path,
- required environment variables,
- database preparation path,
- storage preparation path,
- known runtime/deployment limitations,
- current middleware/proxy warning status.

Update or create:

```text
docs/00-overview/baseline-checks.md
docs/04-server/runtime-config.md
docs/04-server/deployment.md
docs/08-adr/remediation-backlog.md
```

### 5.2 Runtime configuration and `.env.example` hardening

Make runtime configuration explicit and trial-safe.

Tasks:

- Review `.env.example` for completeness.
- Document every required variable.
- Ensure local vs browser-trial deployment variables are distinguishable.
- Ensure secrets are never committed.
- Add or consolidate a typed runtime config helper if the repo already has a suitable pattern.
- Fail fast with clear messages for missing critical runtime variables where appropriate.
- Avoid exposing secrets to the client bundle.

Minimum variables to document/validate if applicable:

```text
DATABASE_URL
SESSION_SECRET / AUTH_SECRET equivalent
NEXT_PUBLIC_APP_URL or APP_BASE_URL equivalent
S3 / MinIO endpoint and credentials if used
storage bucket name
admin seed/bootstrap settings if still used
NODE_ENV
```

Acceptance:

- `.env.example` is usable as a template.
- Missing critical env values fail with actionable errors.
- Docs explain which env values are needed for local dev vs customer trial.

### 5.3 Production build/start baseline

Make the production runtime path explicit and repeatable.

Tasks:

- Verify `npm run build`.
- Verify the intended production start command, e.g. `npm run start`.
- Ensure Prisma client generation and migrations are documented in correct order.
- Add a `README`/docs section for a clean deployment sequence.
- Avoid relying on dev-only commands for customer trial.
- Ensure no dev-only mock credentials are presented as production defaults.

Required documented sequence example:

```bash
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run build
npm run start
```

Adjust commands to the actual repo scripts.

Acceptance:

- A clean operator can follow docs to start the app in production mode.
- Any caveat is documented.

### 5.4 Health and readiness endpoints

Add minimal health/readiness endpoints for browser trial operations.

Recommended routes:

```text
GET /api/health
GET /api/ready
```

Exact names may differ if documented.

Guidance:

- `/api/health` should be cheap and not require auth.
- `/api/ready` may check DB connectivity and, if easy and safe, storage connectivity.
- Responses must not leak secrets.
- Responses should include a simple status and timestamp.
- Use the repo’s canonical API response/header pattern if present.

Example response shape:

```json
{
  "status": "ok",
  "service": "sapen-annotate",
  "timestamp": "2026-05-19T00:00:00.000Z"
}
```

Acceptance:

- Health route is test-covered.
- Readiness route is test-covered or documented if storage/DB mocking is not yet available.
- Docs mention how to use these endpoints in a reverse proxy / uptime check.

### 5.5 HTTPS reverse proxy / Caddy trial baseline

Create a simple customer-trial reverse-proxy guide.

Preferred target: Caddy, because the broader SaPen dev workflow already uses Caddy.

For this ticket, use the customer-trial deployment shape:

```text
caddy
app
postgres
minio
```

All four services should be represented in a Docker Compose based trial runbook. The current local `docker-compose.yml` may remain focused on local Postgres/MinIO development, but the customer-trial baseline should document a reproducible all-Compose path suitable for a Strato-style single host.

Decision to document:

```text
Option A: Next.js as systemd service, DB/MinIO in Docker Compose.
Option B: Next.js also as Docker Compose service.
Chosen for this trial: Option B.
Rationale: clearer volumes, networks, restart policies, and lower host-specific drift.
```

Docs should include:

- recommended hostname placeholder,
- HTTPS expectation,
- reverse proxy to local Next server,
- environment variables affected by public base URL,
- secure-cookie considerations,
- upload/body size considerations for image upload,
- restart strategy caveat.
- MinIO console and S3 API must not be publicly exposed for the customer trial unless explicitly required.
- If MinIO is exposed for admin maintenance, protect it separately and document the risk.

Create or update:

```text
docs/04-server/deployment.md
docs/04-server/reverse-proxy-caddy.md
```

Optional example file:

```text
docs/examples/Caddyfile.sapen-annotate
```

Acceptance:

- The app can be placed behind HTTPS with clear instructions.
- The docs warn that iPad Safari/Pencil testing should be done over the deployed HTTPS URL, not only localhost.
- The chosen Option B Compose deployment shape is documented with rationale.
- Only Caddy is public by default; app, Postgres, and MinIO stay on internal Docker networks.

### 5.5a Prisma migration strategy for the app container

Document exactly when Prisma runs in the trial deployment.

Requirements:

- Use `prisma migrate deploy` for server-side trial deployment.
- Do **not** use `prisma migrate dev` in the customer-trial runbook.
- Document the migration command before starting/restarting the app after schema changes.

Acceptable command shape:

```bash
docker compose -f deploy/docker-compose.trial.yml run --rm app npx prisma migrate deploy
```

Alternatively, add and document a one-shot migration service:

```bash
docker compose -f deploy/docker-compose.trial.yml run --rm migrate
```

Acceptance:

- Trial docs clearly state when migrations are run.
- Trial docs distinguish local development migration commands from server deployment migration commands.

### 5.5b Trial upload/body limits

Image upload limits must be explicit and consistent.

Document and/or implement:

- maximum expected image size for the trial,
- maximum request body size,
- Caddy upload/body limit,
- app-side upload validation where uploads pass through the app,
- behavior for too-large uploads,
- where to raise the limit later.

Acceptance:

- A large camera image fails with a controlled validation error or documented Caddy `413`, not an unexplained server crash.
- Operators know which env/doc setting controls the limit.

### 5.5c Trial user creation, rotation, and attribution

Customer-facing trial access must preserve attribution.

Requirements:

- Do not expose shared demo credentials unless explicitly accepted.
- Prefer named user accounts per tester.
- Document how to create named trial users.
- Document how to rotate/reset trial accounts after the trial.
- Seed/demo credentials may remain local-dev helpers, but must not be presented as the customer-trial default.

Implementation may use one of:

- a seed script mode,
- an npm script,
- a documented Prisma/Admin command,
- or a small dedicated CLI script.

Acceptance:

- Operator has a practical path to create named trial users without manual DB guessing.
- Docs explain why named accounts matter for annotation authorship.

### 5.5d Backup/restore minimum runbook

Single-host local Postgres/MinIO requires a backup compensation story for the trial.

Document concrete, copy-paste-oriented commands at minimum:

- PostgreSQL dump command,
- PostgreSQL restore outline with command,
- MinIO data backup strategy and command or volume path,
- Caddy data/config backup paths,
- what is lost if the host disk fails before backup.

Minimum PostgreSQL dump command shape:

```bash
mkdir -p backups
docker compose -f deploy/docker-compose.trial.yml exec postgres pg_dump -U <user> <db> > backups/sapen-annotate-$(date +%F).sql
```

For MinIO, choose and document either a Docker volume backup or `mc mirror` strategy for v1.

Acceptance:

- Backup/restore is a minimum runnable runbook, not just a concept.
- Docs state that this is not HA and only protects data up to the latest backup.

### 5.6 Browser/iPad PWA baseline without offline caching

Prepare the app for an iPad-friendly browser trial.

Tasks:

- Add or verify Web App Manifest metadata.
- Add app name/short name/icons/theme color.
- Add Apple/iPad relevant metadata where appropriate.
- Ensure viewport/safe-area behavior is reasonable.
- Ensure install-to-Home-Screen is documented.
- Do **not** add a service worker or offline cache in this ticket unless there is already one and it is safe.

Files to inspect/update:

```text
src/app/**/layout.tsx
src/app/manifest.ts or public/manifest.webmanifest
public/**
src/design/**
docs/07-testing/manual-smoke-editor-ipad.md
```

Acceptance:

- App has a coherent browser/iPad identity.
- Home-Screen usage is documented as a manual smoke item.
- No stale offline cache risk is introduced.

### 5.7 Customer trial smoke checklist

Create a deployment-oriented manual smoke checklist.

Required file:

```text
docs/07-testing/manual-smoke-customer-browser-trial.md
```

It must include at least:

#### Deployment smoke

- server has correct `.env`,
- Prisma generate/migrate executed,
- production build succeeds,
- production server starts,
- `/api/health` responds,
- `/api/ready` responds or known limitation is documented,
- HTTPS URL opens through reverse proxy,
- login works,
- session persists across reload,
- logout works if implemented.

#### Desktop browser smoke

- open deployed HTTPS URL,
- login,
- open workspace,
- open/create project if currently supported,
- upload/open image if currently supported,
- open editor,
- draw and save,
- reload and confirm persisted state if supported,
- verify no obvious console/runtime errors.

#### iPad Safari smoke

- open deployed HTTPS URL in Safari,
- login,
- optionally add to Home Screen,
- open editor,
- draw with finger,
- draw with Apple Pencil if available,
- verify page does not scroll while drawing,
- verify page can scroll outside canvas,
- save and reload,
- rotate iPad if relevant,
- record issues.

#### Result tracking

Include a checklist table:

```text
Environment | Tester | Date | Result | Notes
```

Acceptance:

- Checklist is written for a real human tester/operator.
- It distinguishes local dev, production deployment, desktop browser, and iPad Safari.

### 5.8 Resolve or explicitly defer `middleware -> proxy` warning

`npm run build` currently passes with the known Next.js `middleware -> proxy` warning.

Tasks:

- Inspect whether the repo uses `middleware.ts`.
- If migration to `proxy.ts` is small and safe, perform it in this ticket.
- If migration is non-trivial, document exact warning and add a remediation backlog item.
- Do not perform unrelated auth/routing redesign.

Acceptance:

- Either the warning is removed, or it is explicitly documented with a planned remediation path.
- Build remains green.

### 5.9 Tests

Add focused tests only for stable deployment/runtime logic.

Good candidates:

- health endpoint response shape,
- readiness endpoint response shape,
- runtime config validation helper,
- manifest metadata helper if implemented as code,
- API header contract helper if present.

Avoid:

- brittle full-browser tests,
- tests requiring real Caddy,
- tests requiring real iPad,
- real external network calls.

---

## 6. Suggested Implementation Slices

Codex may adapt the sequence, but commits should remain focused.

### Slice 1 — Deployment audit and docs baseline

- Run validation baseline.
- Inspect production/runtime path.
- Document current deployment state and gaps.

Suggested commit:

```bash
git commit -m "docs: record deployment readiness baseline"
```

### Slice 2 — Runtime config and env template hardening

- Update `.env.example`.
- Add/align runtime config helper if appropriate.
- Document env variables and fail-fast behavior.

Suggested commit:

```bash
git commit -m "chore: harden runtime config and env template"
```

### Slice 3 — Health/readiness endpoints

- Add health/readiness routes.
- Add focused tests.
- Document endpoint usage.

Suggested commit:

```bash
git commit -m "feat: add deployment health and readiness endpoints"
```

### Slice 4 — Production runbook and Caddy reverse proxy docs

- Document build/start/migrate sequence.
- Add Caddy example.
- Document HTTPS/session/upload considerations.

Suggested commit:

```bash
git commit -m "docs: add customer trial deployment runbook"
```

### Slice 5 — iPad/PWA browser identity baseline

- Add/verify manifest/metadata/icons.
- Document Home-Screen usage.
- Avoid service worker/offline caching.

Suggested commit:

```bash
git commit -m "feat: add ipad browser app manifest baseline"
```

### Slice 6 — Customer trial smoke checklist and final validation

- Add manual smoke checklist.
- Update backlog.
- Resolve/defer middleware->proxy warning.
- Run final validation.

Suggested commit:

```bash
git commit -m "docs: add customer browser trial smoke checklist"
```

---

## 7. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before the final Codex report.
2. Current deployment/runtime baseline is documented.
3. `.env.example` is complete enough for local and customer-trial deployment.
4. Required runtime variables are documented and validated where appropriate.
5. Production build/start/migrate sequence is documented.
6. Health endpoint exists and is test-covered.
7. Readiness endpoint exists and is test-covered, or any limitation is documented.
8. Caddy/reverse-proxy deployment docs exist.
9. HTTPS/session/upload-size considerations are documented.
10. Browser/iPad app metadata/manifest baseline exists.
11. No service worker/offline cache is introduced unless already present and explicitly justified.
12. Customer browser trial smoke checklist exists at:

```text
docs/07-testing/manual-smoke-customer-browser-trial.md
```

13. The known `middleware -> proxy` warning is either fixed or explicitly tracked in the backlog.
14. Full final validation passes:

```bash
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run check:design-hardcoding
```

15. If available, docs link checks pass:

```bash
npm run check:docs-links
```

16. Ticket is moved to:

```text
tickets/2026-05-19/done/
```

17. Final Codex report includes:
    - commits created,
    - commands run,
    - pass/fail status,
    - health/readiness endpoint status,
    - production runbook status,
    - remaining known deployment gaps,
    - whether manual browser/iPad smoke was run by a human or only documented.

---

## 8. Final Validation Command Block

Codex should finish with:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run check:design-hardcoding
```

Optional if available:

```bash
npm run check:docs-links
```

Optional runtime smoke if feasible in Codex environment:

```bash
npm run build
npm run start
# verify /api/health and /api/ready manually or with a local HTTP check
```

---

## 9. Notes for Codex

- This is a deployment/browser-trial readiness ticket, not a product-domain ticket.
- The app must become easy to provide to a customer through a browser.
- iPad Safari usage remains a first-class requirement.
- Prefer simple, documented deployment over heavy infrastructure.
- Do not add a service worker unless explicitly justified; stale annotation state would be worse than no offline support.
- Preserve the green validation baseline.
- Keep routes thin and use the established `src/features/**`, `src/components/shell/**`, `src/server/**`, and `src/design/**` boundaries.
- If a limitation is real but too large for this ticket, document it precisely and continue.
