# RB-062 - Repository State & Documentation Consistency Sweep

## Status

In Progress

## Priority

High

## Type

Documentation / Repo Hygiene / Architecture Consistency / Validation

## Repository

`sapen-annotate`

## Depends on

- RB-061 - Batch Prediction Import & Background Job Baseline

## Blocks

- RB-063 - Project Operations UX Split
- RB-064 - Auth/RBAC/Audit Hardening
- Customer-facing trial deployment checklist
- Future contributor/Codex work relying on current docs

---

## 1. Context

RB-040 through RB-061 transformed SaPen Annotate from a simple annotation prototype into a substantially complete standalone annotation and training-data preparation platform.

The current codebase now includes:

- modular app architecture and design system baseline,
- desktop browser E2E baseline,
- deployment/trial baseline,
- annotation domain schema,
- project/image/acquisition/sample metadata workflow,
- semantic masks, slice support masks, and slice classifications,
- review/approval and approved-human ground-truth boundary,
- ground-truth training export,
- prediction provenance,
- prediction import,
- active-learning correction task queue,
- assisted correction editor workflow,
- prediction-analysis export,
- DB-backed batch prediction import baseline.

After many rapid slices, documentation and backlog entries can easily drift. RB-061 explicitly added follow-up backlog entries for docs consistency, project operations UI consolidation, batch worker/staging retention hardening, and slice-classification batch imports.

RB-062 is a deliberate pause to align the repository documentation and ticket/backlog state with the actual implementation.

This ticket must not add new product features.

---

## 2. Goal

Make the repository self-consistent and reliable for the next development phase.

At the end of RB-062:

1. `AGENTS.md`, `ARCHITECTURE.md`, `README.md`, and `docs/**` describe the actual current codebase.
2. Old “deferred” statements are removed or updated where the feature is now implemented.
3. Current workflows are documented accurately.
4. Ticket folders/backlog entries reflect done vs active vs future work.
5. Validation commands and test documentation reflect the current suite.
6. Known gaps are current, actionable, and not duplicates.
7. The repo is ready for RB-063+ without misleading docs.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- UI restructuring,
- API changes,
- schema changes,
- auth/RBAC refactor,
- job runner hardening,
- storage retention cleanup,
- editor decomposition,
- customer deployment,
- new tests unless docs tooling requires tiny fixes,
- feature behavior changes.

If inconsistencies reveal code bugs, document them in the remediation backlog unless they are tiny docs-link/build hygiene issues.

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

If `check:docs-links` or similar exists, run it too.

Work in focused slices and commit after each meaningful slice.

---

## 5. Scope

### 5.1 Repository state and ticket hygiene

Inspect:

```text
tickets/
tickets/2026-05-19/
tickets/2026-05-20/done/
tickets/2026-05-20/
tickets/2026-05-20/done/
docs/08-adr/remediation-backlog.md
docs/adr/remediation-backlog.md if present
docs/known-gaps.md
```

Tasks:

- ensure RB-040 through RB-061 done tickets are in `done/`;
- ensure no stale duplicate active ticket remains for completed work;
- ensure future tickets begin at RB-063 or follow current numbering;
- consolidate duplicate backlog entries;
- mark RB-061-related docs/backlog entries correctly;
- ensure optimized ticket files are not duplicated in both active and done unless intentional.

### 5.2 Top-level onboarding docs

Update:

```text
README.md
AGENTS.md
ARCHITECTURE.md
```

Make sure they accurately state:

- current product name and scope,
- local dev commands,
- validation commands,
- deployment/trial path,
- current high-level modules,
- current architecture boundaries,
- ground-truth vs prediction-analysis export distinction,
- iPad requirement and deferred real Safari smoke gate,
- Codex working rules still match current scripts.

Do not bloat `AGENTS.md`; keep it short and rule-focused.

### 5.3 Docs index/navigation

Update:

```text
docs/README.md
docs/00-overview/current-state.md
docs/00-overview/baseline-checks.md
docs/00-overview/product-boundaries.md
```

Ensure navigation points to all important current docs:

- annotation domain,
- metadata workflow,
- editor workflow,
- review/approval,
- training export,
- prediction provenance/import,
- active-learning queue,
- assisted correction,
- prediction-analysis export,
- batch prediction import,
- deployment/trial,
- backup/restore,
- testing/smoke docs.

### 5.4 Architecture and workflow docs

Review and update:

```text
docs/01-architecture/domain-boundaries.md
docs/workflows/README.md if present
docs/03-features/projects.md
docs/03-features/images.md
docs/03-features/editor.md
docs/06-data/annotation-domain-model.md
docs/06-data/mask-and-artifact-versioning.md
docs/06-data/model-prediction-contract.md
docs/06-data/active-learning-task-model.md
docs/06-data/training-export-contract.md
docs/06-data/prediction-analysis-export-contract.md
docs/04-server/batch-prediction-imports.md if present
```

Remove stale claims such as:

- active-learning queue deferred, if implemented;
- assisted correction deferred, if implemented;
- prediction-analysis export deferred, if implemented;
- batch prediction imports deferred, if implemented;
- direct MinIO browser access if now app-mediated;
- `sapen-refine` wording unless historical.

### 5.5 Prisma/schema docs

Update:

```text
docs/06-data/prisma.md
docs/prisma/schema.md if present
docs/prisma/README.md if present
```

Ensure current schema concepts are accurately documented:

- `AnnotationProject`
- `ImageAsset`
- metadata
- artifacts/versions
- support vs semantic masks
- review decisions
- exports
- prediction provenance
- prediction import batches
- audit logs if present
- validation/checksum fields
- migration/rebuild command expectations.

### 5.6 Testing documentation

Update:

```text
docs/07-testing/quality-gates.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
```

Document current commands:

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

Document current test coverage:

- unit/integration count if docs track it,
- Playwright desktop E2E scope,
- current known limitation: real iPad Safari smoke remains manual/deferred until deployment/device access;
- current Playwright system Chrome note if still true.

### 5.7 Deployment/operations docs

Update:

```text
docs/04-server/deployment-trial.md
docs/04-server/backup-restore.md
docs/04-server/batch-prediction-imports.md if present
.env.example
deploy/**
```

Ensure docs mention:

- single-host Docker Compose trial,
- Caddy/app/postgres/minio,
- migrate strategy,
- named trial users,
- backup/restore,
- prediction batch processor command/API,
- limitations of synchronous exports and batch processing,
- no HA guarantee,
- storage retention still deferred if not implemented.

### 5.8 Known gaps and remediation backlog

Update:

```text
docs/known-gaps.md
docs/08-adr/remediation-backlog.md
```

Make entries:

- current,
- non-duplicated,
- prioritized,
- actionable.

Recommended future items after RB-062:

```text
RB-063 Project Operations UX Split
RB-064 Auth/RBAC/Audit Hardening
RB-065 Batch Job Runner Hardening
RB-066 Batch/Staging Storage Retention & Cleanup
RB-067 Prediction QA Metrics / Evaluation Preparation
RB-068 Editor Decomposition
RB-069 Customer Trial Deployment, Handoff Hygiene & iPad Safari Gate
```

Use the exact numbering and wording preferred by the repo if already established.

---

## 6. Specific stale-doc checks

Codex must search for and resolve stale wording patterns:

```bash
rg -n "deferred|not implemented|future|TODO|sapen-refine|Refine|batch import|active-learning|assisted correction|prediction analysis|MinIO URL|direct storage|RB-0(5[3-9]|6[0-1])" docs README.md ARCHITECTURE.md AGENTS.md
```

Do not blindly remove all “deferred” statements. Some are still true. Instead classify each occurrence:

```text
implemented now
still deferred
historical note
wrong/outdated
```

Then update accordingly.

---

## 7. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. No completed RB-040–RB-061 ticket remains active by accident.
3. Docs accurately reflect the implemented RB-053 through RB-061 features.
4. `README.md`, `ARCHITECTURE.md`, and docs index are aligned with the current app.
5. `docs/known-gaps.md` and remediation backlog are current and non-duplicative.
6. Current validation commands are documented.
7. Current deployment/trial and batch import operations are documented.
8. Stale “deferred” wording is corrected where features are now implemented.
9. No product behavior changes are introduced.
10. Ticket is moved to:

```text
tickets/2026-05-20/done/
```

11. Final validation passes:

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

12. Final Codex report includes:
    - commits created,
    - docs changed,
    - stale items corrected,
    - backlog entries added/removed/updated,
    - validation commands run,
    - pass/fail status,
    - remaining known doc gaps if any.

---

## 8. Suggested Commit Sequence

```bash
git commit -m "docs: reconcile repository state after prediction pipeline"
git commit -m "docs: update workflow and data model references"
git commit -m "docs: align operations and testing documentation"
git commit -m "docs: refresh known gaps and remediation backlog"
git commit -m "chore: finalize documentation consistency ticket"
```

---

## 9. Notes for Codex

- This is a consistency sweep, not a feature ticket.
- Do not refactor code unless necessary for docs tooling or broken references.
- Be evidence-backed: reference actual paths and implemented routes.
- Prefer removing misleading docs over adding new long prose.
- Keep docs navigable and concise.
