# SaPen Annotate — Updated Deep Review and Next Steps

**Date:** 2026-05-21  
**Scope:** Repository state after RB-069 and Codex follow-up review  
**Repository:** `sapen-annotate`  
**Purpose:** Consolidated review of current app status, remaining risks, backlog churn, and recommended next tickets before customer-facing trial deployment.

---

## 1. Executive Summary

SaPen Annotate has reached a strong **pre-customer-trial maturity level**.

The app is no longer merely a prototype. It now provides a coherent standalone annotation and training-data preparation platform with:

- a modular App Router and feature architecture,
- a standalone annotation domain model,
- project/image/sample/acquisition metadata workflows,
- semantic material masks,
- slice support masks,
- slice classification,
- review and approval workflows,
- approved-human-only ground-truth export,
- model prediction provenance,
- prediction import,
- active-learning correction tasks,
- assisted correction editor workflow,
- prediction-analysis export,
- batch prediction import,
- single-host batch processing with DB leases,
- staging/storage cleanup,
- repository handoff and deployment gate preparation.

The current state is suitable for the next phase: **customer-trial hardening and real deployment validation**.

The biggest remaining risks are no longer core domain features, but:

1. **Documentation/source-of-truth drift** in top-level architecture/backlog docs.
2. **Inconsistent route-level API error contracts** for unauthenticated/forbidden/project-access errors.
3. **Trial deployment hygiene** around Docker build context and secret exposure.
4. **Editor usability gaps**, especially explicit eraser UX.
5. **Stale client-side API wrappers / presign compatibility remnants**.
6. **Known dependency audit risk**, especially the Prisma CLI advisory chain.
7. **Real iPad Safari validation remains unexecuted** until deployment is available.

Overall assessment:

```text
Core product workflow:        strong
Training data integrity:      strong
Prediction workflow:          strong for trial
Operations baseline:          good for single-host trial
Customer-trial security:      improved, but route-level hardening still needed
iPad readiness:               architecturally prepared, but not physically validated
Documentation consistency:    mostly good, but top-level drift remains
```

---

## 2. Current App Status

### 2.1 Implemented product capabilities

The app now supports a broad end-to-end workflow:

```text
Project setup
→ image upload
→ technical/acquisition/sample metadata
→ semantic mask annotation
→ slice support mask annotation
→ slice classification
→ review/approval
→ approved-human ground-truth export
```

The prediction-assisted workflow is also substantially implemented:

```text
ModelRun / PredictionRun provenance
→ prediction import
→ prediction provenance
→ active-learning correction task
→ assisted correction editor
→ human correction draft
→ review/approval
→ approved-human export
```

Prediction-analysis workflows are explicitly separate:

```text
Prediction-analysis export
→ model proposals / QA metadata
→ optional human reference links
→ not ground-truth training labels
```

### 2.2 Trial deployment and operations

The single-host trial architecture is coherent:

```text
Caddy
Next.js app
PostgreSQL
MinIO
optional Compose worker
```

The current operational model is appropriate for a small customer trial with approximately **3–5 annotators**.

The DB-backed lease model for background/batch processing is suitable for this scale. Annotator concurrency does not require Redis/BullMQ/RabbitMQ; those would currently be overengineering.

### 2.3 Testing status

The repo has strong validation discipline:

- lint
- typecheck
- build
- unit/integration tests
- Playwright E2E
- design-hardcoding check
- Compose config checks
- handoff archive dry-run

The suite has grown significantly and now covers many domain boundaries:

- semantic vs support masks,
- Copper-not-support invariants,
- review/approval,
- approved-only export,
- prediction-not-ground-truth,
- prediction import,
- batch processing,
- cleanup,
- route workflows.

---

## 3. Consolidated Findings

## Finding 1 — Source-of-truth drift remains in top-level docs

Even after RB-062/RB-069, Codex found that `ARCHITECTURE.md` still contains stale claims, including references to:

- removed `src/server/storage.ts` legacy helper,
- missing worker/cleanup gaps that are now implemented,
- missing rate limiting that RB-064 has already addressed.

This matters because `ARCHITECTURE.md` is a primary entry point for Codex and future contributors.

### Risk

Codex or a human developer may make incorrect architectural assumptions and reopen solved problems.

### Recommendation

Create a focused hotfix ticket:

```text
RB-071 — Architecture / Docs / Backlog Consistency Hotfix
```

Keep it small and targeted.

---

## Finding 2 — API auth/error contracts are not consistently enforced at route level

Some route handlers reportedly call authentication/authorization helpers such as `requireUser()` or `requireProjectRole()` before structured error handling. Example cited by Codex:

```text
src/app/api/projects/[projectId]/route.ts:24
```

This can produce inconsistent or generic failures instead of stable JSON error payloads for:

- unauthenticated requests,
- forbidden access,
- project not found,
- project access denied,
- conflict/validation errors.

### Risk

For customer-facing use, inconsistent API failures make debugging and UI error handling harder. They also weaken API contract stability.

### Recommendation

Create:

```text
RB-072 — Route-level API Auth/Error Contract Hardening
```

This should add or standardize route-level helpers so representative API routes return consistent JSON errors.

---

## Finding 3 — Trial deployment hygiene has two concrete gaps

Codex identified two deployment/build-context issues:

1. `.dockerignore` does not exclude several generated or local artifacts:
   - Playwright reports,
   - test results,
   - archives,
   - backups,
   - caches,
   - build outputs.

2. `deploy/docker-compose.trial.yml` reportedly interpolates MinIO credentials into rendered Compose config/process metadata.

### Risk

The handoff archive may be clean, but Docker build context can still include irrelevant or sensitive files. Compose-rendered credentials can end up in logs, process metadata, or command output.

### Recommendation

Create:

```text
RB-073 — Trial Deployment Secret & Build-Context Hygiene
```

This should harden `.dockerignore`, Compose secret handling, and trial runbook guidance.

---

## Finding 4 — Editor remains the largest product-risk area

RB-068 reduced `EditorClient.tsx`, but the editor still remains large and central.

Known editor risk areas:

- explicit eraser UX is missing,
- EditorClient remains large,
- future iPad UX depends heavily on editor behavior,
- multi-slice/multi-object work would likely stress the current editor further.

The active ticket already exists:

```text
RB-070 — Editor Eraser Tool UX
```

### Risk

For real annotators, not having an explicit eraser is a daily productivity and usability problem. Painting background as a workaround is weaker, especially on iPad.

### Recommendation

Implement RB-070 soon, but after RB-071/RB-072/RB-073 because those affect trial reliability/security.

---

## Finding 5 — Client API wrappers are stale

Codex found stale `src/lib` API wrappers still referencing presign/commit flows and fields like `storageKey`, while the UI has moved toward app-mediated upload/read paths.

### Risk

This creates maintainability risk and may lead future code back toward deprecated direct-storage assumptions.

### Recommendation

Create:

```text
RB-074 — Client API Wrapper / Presign Compatibility Cleanup
```

This should remove or align stale wrappers and document whether presign compatibility routes remain internal/admin-only or should be deprecated.

---

## Finding 6 — Dependency audit / Prisma advisory remains unresolved

Codex reported:

```text
npm audit --json still reports the known moderate Prisma CLI advisory chain.
```

### Risk

Not necessarily urgent, but should not remain ambiguous before customer trial.

### Recommendation

Create:

```text
RB-075 — Dependency Audit / Prisma Version Policy
```

This should re-check the advisory, decide whether to pin/upgrade/defer, and document accepted risk.

---

## Finding 7 — Real iPad Safari gate remains pending

The app has been prepared for iPad:

- pointer handling,
- iPad docs,
- PWA/home-screen metadata,
- responsive layout,
- editor decomposition,
- manual smoke checklists.

But the real iPad Safari test has not yet been executed because deployment/device access is not available.

### Risk

Subtle iPad Safari issues often appear only on the actual device:

- canvas scaling,
- scroll blocking,
- Apple Pencil behavior,
- viewport/rotation,
- file upload behavior,
- Home Screen web app quirks.

### Recommendation

Do not mark iPad readiness as passed until tested on real deployment.

Keep:

```text
RB-069 customer trial gate
```

as prepared, but execute the physical gate only once deployment exists.

---

## Finding 8 — Backlog contains valid items, but needs triage

Codex identified remaining good candidates:

- editor/iPad UX,
- Prisma CLI audit findings,
- audit UI,
- cleanup UI,
- review dashboards,
- export history / async exports,
- slice-specific metadata,
- multi-slice / multi-object support,
- real iPad Safari validation.

### Recommendation

Do not implement all of these now. For today, focus on trial blockers:

```text
RB-071
RB-072
RB-073
RB-070
RB-074
RB-075
```

Then deploy/test before adding larger features.

---

## 4. What Can Be Churned / Deferred

### 4.1 Churn now

The following should be cleaned up soon:

```text
ARCHITECTURE.md stale claims
Known gaps/backlog duplicates
Stale src/lib wrappers
Docker build context ignores
Compose credential interpolation
Route-level error inconsistency
```

### 4.2 Defer until after deployment/iPad test

These are valid but should wait:

```text
advanced iPad zoom/pan
multi-slice/multi-object support
slice-specific metadata
review dashboard
export history dashboard
async export worker
prediction QA dashboard
audit UI
enterprise identity provider
```

### 4.3 Keep as explicit known limitations

The following limitations are acceptable for the first trial if documented:

```text
single-host, no HA
no public MinIO
bounded batch processing
manual iPad gate pending
trial-sized synchronous exports
no enterprise SSO
no multi-slice workflow unless customer images require it
```

---

## 5. Updated Ticket Sequence

### Immediate sequence

```text
RB-071  Architecture / Docs / Backlog Consistency Hotfix
RB-072  Route-level API Auth/Error Contract Hardening
RB-073  Trial Deployment Secret & Build-Context Hygiene
RB-070  Editor Eraser Tool UX
RB-074  Client API Wrapper / Presign Compatibility Cleanup
RB-075  Dependency Audit / Prisma Version Policy
```

### After those

```text
RB-076  Customer Trial Deployment Dry Run
RB-077  Real iPad Safari Trial Gate Execution
RB-078  Post-Trial Findings / Triage
```

### Later / only if needed

```text
Advanced iPad Zoom/Pan
Multi-slice / Multi-object Workflow Design
Slice-specific Metadata
Review Dashboard
Audit UI
Async Export Worker
Prediction QA Dashboard
Enterprise Auth / SSO
```

---

## 6. Recommended Ticket Details

## RB-071 — Architecture / Docs / Backlog Consistency Hotfix

### Goal

Fix stale top-level docs after RB-064–RB-069.

### Scope

- update `ARCHITECTURE.md`,
- update current-state docs,
- update known gaps,
- update remediation backlog,
- update docs around `src/lib` if needed,
- optionally add lightweight docs-link/check command if practical.

### Non-goals

- no product code changes,
- no API behavior changes,
- no security implementation,
- no UI work.

### Why first?

Because `ARCHITECTURE.md` is a Codex entry point. Stale claims can misdirect future tickets.

---

## RB-072 — Route-level API Auth/Error Contract Hardening

### Goal

Ensure representative API route handlers return stable JSON errors for auth/project failures.

### Scope

- add or reuse API error helper,
- wrap route handlers consistently,
- test representative endpoints:
  - project routes,
  - image routes,
  - export routes,
  - prediction routes,
  - auth routes,
- enforce canonical 401/403/404/409 where applicable.

### Non-goals

- no domain semantics changes,
- no broad route rewrite,
- no new permissions.

### Why second?

Customer-facing errors must be predictable before deployment.

---

## RB-073 — Trial Deployment Secret & Build-Context Hygiene

### Goal

Harden deployment context and Compose secret handling.

### Scope

- improve `.dockerignore`,
- avoid MinIO credentials rendered into Compose command/process metadata,
- update deployment docs,
- add config smoke test if useful.

### Non-goals

- no production monitoring,
- no HA,
- no deployment execution if server access unavailable.

### Why third?

This is directly trial-deployment relevant.

---

## RB-070 — Editor Eraser Tool UX

### Goal

Add explicit eraser UX for semantic/support mask editing.

### Scope

- eraser mode/tool,
- touch/pointer behavior,
- dirty state,
- save/reload,
- undo/redo if already supported or add minimal history only if scoped,
- unit/E2E tests.

### Non-goals

- no new mask format,
- no advanced brush engine,
- no multi-object editor.

### Why after RB-071–073?

It is user-facing and important, but less deployment/security critical.

---

## RB-074 — Client API Wrapper / Presign Compatibility Cleanup

### Goal

Remove or align stale client wrappers and direct-storage assumptions.

### Scope

- audit `src/lib`,
- remove unused presign/commit wrappers,
- align types with app-mediated upload/read,
- decide whether presign compatibility routes remain,
- update docs.

### Non-goals

- no upload architecture redesign,
- no storage migration.

---

## RB-075 — Dependency Audit / Prisma Version Policy

### Goal

Resolve or document the Prisma CLI advisory chain.

### Scope

- run audit,
- check Prisma versions,
- decide upgrade/pin/defer,
- document accepted risk if deferred,
- keep gates green.

### Non-goals

- no broad dependency upgrade spree,
- no framework migration.

---

## 7. Final Prioritization Rationale

The revised order is:

```text
Docs/source-of-truth
→ API contract reliability
→ deployment hygiene
→ user-facing eraser UX
→ client wrapper cleanup
→ dependency audit policy
```

This order prioritizes customer-trial reliability before new convenience features.

The app is already functionally powerful. The next risk is not missing capability, but making the existing capabilities reliable, explainable, deployable, and safe for the first external users.

---

## 8. Conclusion

SaPen Annotate is now close to a deployable customer-trial version.

The strongest achievements are:

- domain model is mature,
- prediction and ground truth are cleanly separated,
- export semantics are safe,
- operations are single-host viable,
- tests are strong,
- deployment/handoff has been prepared.

The next work should be conservative and trial-focused:

1. fix documentation drift,
2. harden API error contracts,
3. harden deployment/build context,
4. add eraser UX,
5. clean stale API wrappers,
6. close dependency audit policy.

After that, a real Strato deployment and iPad Safari smoke test should be the priority before large new features.
