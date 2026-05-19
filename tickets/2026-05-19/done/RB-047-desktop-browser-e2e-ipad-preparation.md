# RB-047 — Desktop Browser E2E Baseline & iPad Trial Preparation

## Status

Done

## Priority

High

## Type

Testing / Trial Readiness / Browser Workflow / iPad Preparation

## Repository

`sapen-annotate`

## Depends on

- RB-046 — Customer Browser Deployment & Trial Readiness Baseline

## Blocks

- Annotation domain model implementation
- Customer-facing trial rollout
- Admin training export
- Model-assisted preprediction

---

## 1. Context

RB-046 established a deployable single-host trial baseline with a full Docker Compose setup
(`caddy`, `app`, `postgres`, `minio`), health/readiness endpoints, named trial users,
PWA/iPad metadata, backup/restore docs, and a customer browser smoke checklist.

However, a real Strato deployment and a real iPad Safari smoke test cannot currently be executed.
The iPad requirement remains important, but it must not block all further progress.

This ticket therefore shifts the next step to what can be validated now:

- strengthen the PC/desktop browser path,
- add automated browser smoke coverage where feasible,
- prepare iPad test assets/docs as far as possible,
- keep the app deployable and customer-trial-ready,
- avoid domain-model expansion until the current MVP browser workflow is proven.

This ticket is a bridge between infrastructure readiness and real annotation-domain work.

---

## 2. Goal

Create a reliable desktop browser E2E/smoke baseline for the current MVP workflow and prepare
the iPad trial validation so it can be executed later as soon as deployment and device access are available.

The goal is not to add new annotation features. The goal is to prove and protect the current browser workflow.

Expected outcome:

- a repeatable desktop browser smoke path,
- a small automated browser test harness if feasible,
- documented current MVP workflow limitations,
- iPad readiness checklist refined into an executable later gate,
- no hidden regression in login, project/image/editor/save flow,
- green existing validation baseline.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- new annotation domain schema,
- T-number/specimen/slice/acquisition metadata model,
- admin export/download,
- model preprediction or active-learning ranking,
- Core handoff/correction workflow,
- advanced iPad gesture/zoom/pan implementation,
- real Strato deployment,
- real iPad Safari execution,
- large editor rewrite,
- visual redesign.

If these issues are discovered, add them to the remediation backlog.

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

2. Record the pre-change baseline in docs.
3. Work in meaningful slices.
4. At the end of each slice:
   - run relevant checks,
   - update docs,
   - create a detailed focused Git commit.
5. Keep the app runnable after every meaningful slice.
6. Do not mix unrelated completed slices in one commit.

---

## 5. Scope

### 5.1 Audit current MVP browser workflow

Inspect and document the current browser workflow from a user's perspective:

- login,
- workspace open,
- project list/create/open,
- image upload/open,
- editor open,
- draw,
- save/commit,
- reload and confirm persisted state where currently supported.

Update or create:

```text
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/03-features/editor.md
docs/03-features/projects.md
docs/03-features/images.md
docs/known-gaps.md
docs/08-adr/remediation-backlog.md
```

Clearly distinguish:

- implemented behavior,
- MVP limitations,
- known blockers,
- deferred iPad-only validation.

### 5.2 Add a desktop browser smoke automation baseline if feasible

Add a small automated browser smoke harness if the current stack supports it without excessive scope.

Preferred approach:

- Use Playwright only if it can be added/configured cleanly.
- Keep tests minimal and robust.
- Do not create a large E2E suite.

Minimum useful smoke path:

```text
open login
→ login with named/dev test user
→ reach workspace
→ open/create project if supported
→ open image/editor path if stable fixtures exist
```

If upload/editor persistence automation is too large for this ticket, document why and stop at a smaller stable smoke.

Rules:

- Do not require real Strato deployment.
- Do not require real iPad.
- Prefer local production or test server.
- Use deterministic test users/fixtures.
- Avoid brittle selectors; add accessible labels/test ids only where appropriate.

Suggested script names:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

If Playwright is not introduced, document the reason and strengthen manual smoke docs instead.

### 5.3 Protect current editor-critical behavior with additional tests

Extend unit/integration coverage only for stable logic that matters for browser operation.

Good candidates:

- canvas coordinate helpers added in RB-045,
- save/dirty state pure helpers if available,
- route/proxy public/private behavior,
- health/ready endpoint behavior,
- trial user creation utility if testable without external services.

Avoid brittle UI tests tied to unstable markup.

### 5.4 Prepare iPad validation as a later explicit gate

Because real iPad execution is not possible now, refine the iPad docs so the later test is easy to execute.

Update:

```text
docs/07-testing/manual-smoke-editor-ipad.md
docs/07-testing/manual-smoke-customer-browser-trial.md
```

Add a clear deferred gate section:

```text
Deferred Gate: Real iPad Safari Trial
Status: Not executed in RB-047
Required before customer pilot: yes
Reason: deployment/device access unavailable
```

Include:

- required device/browser,
- test account,
- deployed URL,
- expected steps,
- result table,
- failure logging template,
- blocking vs non-blocking criteria.

### 5.5 Document decision: proceed with desktop-browser MVP first

Add an ADR or architecture note documenting the temporary sequencing decision:

```text
docs/08-adr/ADR-002-desktop-browser-first-ipad-deferred.md
```

The ADR should state:

- iPad support remains a first-class requirement,
- real iPad validation is deferred only because deployment/device access is unavailable,
- desktop browser MVP will continue in parallel,
- code should continue avoiding choices that would make iPad support harder,
- real iPad smoke remains mandatory before customer pilot.

### 5.6 Final validation and docs alignment

Run:

```bash
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run check:design-hardcoding
```

If `test:e2e` is added and feasible:

```bash
npm run test:e2e
```

Update final check results in docs.

---

## 6. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Current desktop browser MVP workflow is documented from login through editor/save where supported.
3. Current browser workflow blockers and limitations are documented honestly.
4. A small automated desktop browser smoke baseline exists, **or** a clear reason is documented why it was deferred.
5. Any added E2E/test scripts are documented and pass locally.
6. Existing unit/build/lint/typecheck/test/design checks remain green.
7. iPad manual smoke docs are refined into an executable later gate.
8. An ADR documents that desktop browser MVP continues first while real iPad validation is deferred.
9. No domain-model expansion is introduced.
10. Ticket is moved to:

```text
tickets/2026-05-19/done/
```

11. Final Codex report includes:
    - commits created,
    - commands run,
    - pass/fail status,
    - browser smoke status,
    - whether E2E automation was added,
    - iPad deferred gate status,
    - remaining known gaps.

---

## 7. Suggested Commit Sequence

Codex may adapt the sequence, but commits should remain focused.

```bash
git commit -m "docs: record desktop browser smoke baseline"
git commit -m "test: add desktop browser smoke harness"
git commit -m "test: extend browser-critical unit coverage"
git commit -m "docs: prepare deferred ipad safari trial gate"
git commit -m "docs: record desktop-first ipad-deferred sequencing decision"
git commit -m "chore: finalize browser smoke baseline ticket"
```

---

## 8. Notes for Codex

- This is a trial-readiness/testing ticket, not a product-domain ticket.
- Do not block progress on unavailable Strato/iPad execution.
- Keep iPad support architecturally protected even if real validation is deferred.
- Prefer a small reliable browser smoke over a broad brittle E2E suite.
- Keep all existing validation gates green.
- If the current MVP workflow is too incomplete for a full smoke, document the exact missing pieces and create backlog entries.

---

## Completion Notes

Completed in RB-047 implementation.

- Documented the desktop browser MVP smoke path and current MVP limitations.
- Routed normal browser image and mask reads through app-mediated routes so MinIO can remain private during the customer-trial deployment.
- Added Playwright E2E scripts and tests:
  - `npm run test:e2e`
  - `npm run test:e2e:headed`
  - `npm run test:e2e:ipad-prep`
- Added a desktop Chrome smoke that logs in, creates a project, uploads an image fixture, opens the editor, draws, saves, reloads, and verifies latest mask persistence.
- Added an iPad-sized Chromium preparation smoke for login viewport and manifest availability; this is not a substitute for real iPad Safari.
- Added ADR-002 documenting desktop-browser-first sequencing while real iPad validation is deferred.
- Refined iPad smoke docs with the explicit deferred gate and blocking failure criteria.
- Final validation passed:
  - `npm run prisma:generate`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - `npm run test`
  - `npm run check:design-hardcoding`
  - `npm run test:e2e`
- Real iPad Safari smoke remains not executed in RB-047 because deployment/device access is unavailable.
