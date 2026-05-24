# RB-115 - System Actor Attribution Model ADR (Post-RB-114)

## Status

Done

## Priority

P3 now, P2 before broader automation/Core handoff

## Type

ADR / Attribution / Audit / Background Workers / Operator Actions / Governance

## Source

- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- `AGENTS.md` attribution invariant.
- Completed RB-106: protected API error contract completion.
- Completed RB-111: high-cost rate limiting.
- Completed RB-112: async export job processing.
- Completed RB-114: storage/DB consistency reporting.

## Depends On

- Current auth/RBAC/audit model.
- Existing `User`, `AuditLog`, export, cleanup, prediction-import, and worker attribution behavior.
- RB-113 remains open and must not be completed or modified by this ticket.

## Blocks

- Clear attribution for scheduled workers, cleanup, consistency checks, export processors, import processors, and future Core handoff.
- Consistent future audit decisions for non-human or operator-triggered actions.
- RB-116 audit coverage matrix, if system actor semantics affect classification.

## Context

`AGENTS.md` requires writes to be attributable to an authenticated user or an explicitly identified system actor.

The repository has now accumulated multiple non-purely-interactive workflows:

- RB-111 introduced DB-backed high-cost rate-limit buckets.
- RB-112 introduced async `ExportBatch` jobs and an export processor path.
- RB-114 extended storage cleanup with consistency reporting and hard-drift behavior.
- Prediction import batch processing and cleanup scripts already have operator/system-like behavior.
- Future Core handoff and scheduled automation will increase the need for clear non-human attribution.

Current trial flows are mostly user-driven, but the model is no longer purely “browser user clicks and writes row”. Before adding more automation, the repo needs a clear ADR that answers how system actors, operator-triggered jobs, and worker processors should be represented in audit/domain records and logs.

This ticket is intentionally ADR-first. It should decide the model and create follow-up implementation tickets only if needed.

## Goal

Create an ADR that defines the system actor attribution model for SaPen Annotate.

The ADR must establish a single conceptual model for:

- authenticated human users,
- operator-triggered CLI/script actions,
- scheduled/system-triggered jobs,
- background workers/processors,
- future Core handoff/system integrations.

It must also define how attribution should appear in:

- `AuditLog`,
- append-only domain rows,
- export job records,
- cleanup/consistency logs,
- prediction import processing,
- operational logs,
- future review/export/audit matrices.

## Non-Goals

- Do not implement broad schema changes in this ticket unless the ADR deliberately scopes a tiny metadata/doc-compatible change.
- Do not rewrite auth, RBAC, sessions, or login flows.
- Do not change RB-111 rate-limit behavior.
- Do not change RB-112 async export job processing behavior.
- Do not change RB-114 cleanup/consistency behavior.
- Do not complete or fabricate RB-113 iPad evidence.
- Do not implement Core handoff behavior.
- Do not build an audit dashboard.

If the ADR selects a model requiring code/schema work, create focused follow-up tickets instead of implementing it inside RB-115.

## ADR Location And Naming

Add a new ADR in the repository's active ADR location, following current repo conventions, for example:

- `docs/adr/ADR-XXX-system-actor-attribution-model.md`

If the repo uses a different active ADR numbering/path convention, follow that convention and update the relevant ADR index/backlog links.

## Required Investigation

Before writing the ADR, inventory current attribution behavior across at least:

### Human/API Actions

- project/image upload,
- mask/crop/support/semantic saves,
- slice BBox and metadata updates,
- review decisions,
- export creation requests,
- prediction import creation/upload requests.

### Worker/Processor Actions

- async export processing from RB-112,
- prediction import batch processing,
- cleanup/consistency reporting from RB-114,
- any processor IDs, leases, retry fields, or nullable creator fields.

### Audit And Domain Records

- `AuditLog`,
- `ExportBatch`,
- export package metadata if present,
- prediction import/batch records,
- cleanup audit rows/log records,
- review/export append-only rows,
- any rows with nullable `createdBy`, `processedBy`, `processorId`, `actorId`, or equivalent.

### Operational Scripts

- export processing script,
- storage cleanup script,
- prediction import processing script,
- any admin/operator API routes used by scripts.

Document the current state in the ADR as the baseline.

## ADR Options To Compare

The ADR must compare at least these options:

### Option A - Special `User` Rows For System Actors

Represent non-human actors as reserved `User` rows, for example:

- `system:export-worker`,
- `system:cleanup`,
- `system:prediction-import-worker`,
- `system:core-handoff`.

Assess:

- Prisma/schema compatibility,
- uniqueness and login prevention,
- display names,
- audit clarity,
- risks of confusing system actors with human accounts,
- migration complexity.

### Option B - Separate Actor Table Or Actor Type Model

Introduce a separate actor abstraction, for example:

- `Actor`,
- `ActorType = USER | SYSTEM | OPERATOR | EXTERNAL_SYSTEM`,
- references from audit/domain rows.

Assess:

- semantic correctness,
- migration cost,
- relationship to existing `User` references,
- future flexibility,
- near-term complexity.

### Option C - Explicit Actor-Type Fields In Audit/Domain Records

Keep human `User` references where they exist, but add explicit fields where needed, for example:

- `actorType`,
- `actorId`,
- `actorLabel`,
- `triggeredByUserId`,
- `processorId`,
- `systemActor`.

Assess:

- incremental migration path,
- partial coverage risk,
- query complexity,
- fit with current records.

### Option D - Status Quo With Local Conventions

Keep current attribution patterns and document local conventions only.

Assess:

- why this is or is not sufficient after RB-111/RB-112/RB-114,
- risks for future automation and Core handoff,
- what breaks in RB-116 audit coverage.

## Required ADR Decisions

The ADR must explicitly decide or defer with clear rationale:

1. What is the canonical term: `actor`, `user`, `system actor`, `operator`, `processor`, `external system`?
2. How should a background worker be attributed when:
   - a human user requested the work,
   - a scheduled job triggered the work,
   - an operator manually ran a CLI script?
3. How should `triggeredBy` vs `performedBy` be represented conceptually?
4. Should system actors be persisted as DB rows or only appear in structured logs/domain fields?
5. How should system actors be displayed in UI/docs, if they appear at all?
6. How should cleanup and consistency checks be attributed?
7. How should export job processing be attributed after RB-112?
8. How should prediction import batch processing be attributed?
9. What is required before future Core handoff is added?
10. Which existing rows are acceptable as-is, and which require future migration?
11. What should RB-116 use as the audit classification model?

## Recommended Direction To Evaluate

Do not assume this without verifying current schema/code, but a likely good direction is:

- keep human `User` attribution for user-requested records;
- distinguish `requestedBy` / `triggeredBy` from `processedBy` / `performedBy`;
- use explicit named system actor labels for background processors and scheduled jobs;
- avoid allowing system actor identities to log in;
- avoid broad migration if current trial records are already attributable;
- create follow-up tickets only for gaps where nullable or ambiguous attribution could affect auditability.

The ADR may choose a different approach if the codebase strongly favors it.

## Required Outputs

- New ADR documenting:
  - current baseline,
  - options considered,
  - decision,
  - consequences,
  - migration/follow-up plan,
  - impact on RB-116 audit coverage.
- Updated ADR index/backlog links.
- Updated remediation backlog entry for RB-115.
- Follow-up tickets only if implementation work is required.
- No product behavior changes unless explicitly justified as tiny docs-compatible cleanup.

## Follow-Up Ticket Guidance

If follow-ups are needed, they should be narrow, for example:

- `RB-115-A-system-actor-schema-fields.md`
- `RB-115-B-export-worker-attribution-fields.md`
- `RB-115-C-cleanup-consistency-actor-labels.md`
- `RB-115-D-prediction-import-worker-attribution.md`

Do not create vague broad tickets like “fix audit”.

## Acceptance Criteria

- A system actor attribution ADR exists and follows repo ADR conventions.
- The ADR compares at least the required options.
- The ADR defines `triggeredBy` vs `performedBy` semantics.
- The ADR explicitly covers async export jobs, cleanup/consistency checks, prediction import processing, and future Core handoff.
- The ADR states whether current behavior is acceptable for the customer trial.
- The ADR identifies any required follow-up implementation tickets.
- RB-116 can use the ADR as its classification basis.
- RB-113 remains open unless real iPad evidence was separately provided.

## Validation

For docs/ADR-only implementation:

```bash
git status --short
git diff --check
npm run lint
npm run handoff:archive -- --dry-run
```

If Codex touches code, schema, tests, or package scripts, also run the relevant expanded validation:

```bash
npm run prisma:generate
npm run typecheck
npm run build
npm run test
```

## Completion Protocol

When complete:

1. Add the ADR and update ADR/backlog indexes.
2. Move this optimized RB-115 ticket to the appropriate `done/` folder.
3. Leave RB-113 open unless physical iPad evidence exists.
4. Create focused follow-up tickets only for concrete implementation gaps.
5. Commit the docs/ADR slice.
6. Ensure the worktree is clean and `npm run handoff:archive -- --dry-run` passes.

## Notes For Codex

- This is an ADR decision ticket, not an implementation sprint.
- Do not fabricate iPad evidence for RB-113.
- Do not alter storage cleanup or export job behavior unless the ADR needs a tiny documentation link update.
- Prefer clear terminology over broad schema churn.
- Be explicit about what is accepted for trial and what must be implemented before broader automation/Core handoff.
