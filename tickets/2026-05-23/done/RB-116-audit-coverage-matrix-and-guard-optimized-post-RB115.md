# RB-116 - Audit Coverage Matrix And Guard (Post-RB-115)

## Status

Completed

## Priority

P3/P2

## Type

Audit / API Governance / Mutation Inventory / Test Guard / Documentation

## Source

- `tickets/2026-05-23/sapen_annotate_deep_review_report_chatGPT.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `docs/known-gaps.md`
- Completed RB-106: protected API error contract completion and route guard.
- Completed RB-115: `docs/08-adr/ADR-007-system-actor-attribution-model.md`.

## Depends On

- RB-106 route inventory/guard baseline.
- RB-115 ADR-007 system actor attribution decision.
- Current mutation route and domain write model.
- RB-113 remains open and must not be completed or modified by this ticket.

## Blocks

- Confidence that new mutation routes remain attributable.
- Reviewability of future API/domain writes.
- Follow-up implementation of ADR-007 actor-context fields where needed.
- Safe expansion of automation/Core handoff without invisible writes.

## Context

Audit coverage is broad but not machine-enforced. New mutation routes or domain write paths can be added without either:

- an `AuditLog` event,
- an append-only domain row with user/actor attribution,
- a documented system actor/processor context,
- or an explicit exemption.

RB-115 added ADR-007 and chose an explicit actor-context model based on current user attribution, with conceptual distinction between:

- `triggeredBy` / `requestedBy`: who or what initiated the work;
- `performedBy` / `processedBy`: who or what executed the write or background processing.

RB-116 must use that ADR as the classification basis. The purpose is not to force every mutation to write a new `AuditLog` row. Some writes are already sufficiently attributable through append-only domain rows, export records, review decisions, job records, or operator logs. The purpose is to make coverage visible, reviewed, and guarded.

This ticket is a governance/test hardening ticket, not an audit-dashboard feature and not a broad schema migration.

## Goal

Create an audit coverage matrix and automated guard so that mutation paths cannot be added or changed without being classified.

A successful RB-116 should answer for each mutation path:

- What is the mutation?
- Where is it implemented?
- Who/what can trigger it?
- What persisted record proves it happened?
- How is the human user, operator, system actor, or processor attributed?
- Is attribution sufficient for the current trial?
- Is there a known follow-up needed under RB-115-A/B/C or future Core handoff work?
- Is the path intentionally exempt from audit, and why?

## Non-Goals

- Do not implement the full ADR-007 actor-context schema migration unless a tiny local metadata change is unavoidable.
- Do not force every mutation to write `AuditLog` if another append-only attributable domain row is the proper audit artifact.
- Do not create an audit UI/dashboard.
- Do not change product workflows.
- Do not change RB-111 rate-limit behavior.
- Do not change RB-112 export job architecture.
- Do not change RB-114 cleanup/consistency behavior.
- Do not implement RB-115-A/B/C follow-ups in this ticket.
- Do not complete or fabricate RB-113 iPad evidence.

If the matrix reveals a concrete attribution gap, either:
1. fix it only if it is very small and clearly within RB-116 scope, or
2. create a focused follow-up ticket.

## Required Outputs

### 1. Audit Coverage Matrix

Add a machine-readable or semi-structured matrix close to the audit/testing docs, for example:

- `docs/testing/audit-coverage-matrix.md`, or
- `docs/auth-rbac-audit/audit-coverage-matrix.md`, depending on current repo conventions.

The matrix should include at least these columns:

- `id`: stable matrix id, for example `MUT-IMAGE-UPLOAD`.
- `area`: upload, editor, crop, review, export, prediction, cleanup, admin, auth, project, etc.
- `route_or_entrypoint`: API route, CLI script, worker processor, server action, or domain command.
- `method_or_trigger`: POST/PATCH/DELETE, CLI command, scheduled worker, operator call.
- `domain_write`: main Prisma/domain writes.
- `attribution_mechanism`: `AuditLog`, append-only domain row, job row, actor context, operator log, exemption.
- `triggered_by`: human user, operator, system actor, external system, future Core.
- `performed_by`: web request, export worker, prediction worker, cleanup operator, scheduled job, etc.
- `rb115_actor_context_status`: current / sufficient for trial / follow-up required.
- `audit_sufficiency`: sufficient / partial / missing / exempt.
- `follow_up`: none or linked ticket.
- `notes`: short reason.

The exact column names may differ if repo docs have an existing pattern, but the semantics must be present.

### 2. Mutation Route/Entrypoint Inventory

Inventory at minimum:

#### API Mutation Routes

All `src/app/api/**/route.ts` handlers that expose mutation methods:

- POST
- PUT
- PATCH
- DELETE

Include protected routes and admin/operator routes.

#### Operational Scripts

Include mutation-capable scripts such as:

- export processor scripts from RB-112,
- storage cleanup scripts from RB-114,
- prediction import processing scripts,
- seed/admin scripts only if relevant to deployed operations.

#### Worker/Processor Entrypoints

Include:

- async export processing,
- prediction import batch processing,
- cleanup/consistency execution,
- any scheduled or process-due endpoint.

#### Domain Write Commands

Where mutation is primarily domain-service driven, include the domain command or service function if route inventory alone is too shallow.

### 3. Guard Test Or Script

Add an automated guard that fails when mutation entrypoints are missing from the matrix.

Preferred approach:

- A unit test or script scans `src/app/api/**/route.ts` for exported mutation handlers.
- It extracts route path and mutation methods.
- It compares them against matrix entries.
- It allows an explicit short allowlist for generated/public/non-persistent routes, with comments.
- It fails on new unclassified mutation routes.

Also cover operational scripts/worker entrypoints where practical. If complete script scanning is too brittle, start with a curated list and a test that ensures the matrix includes all known processor commands.

The guard should not require hitting a live database.

### 4. Classification Rules

Document the classification rules used by the matrix.

At minimum:

- `AuditLog` is required when a user/operator action changes governance, permissions, project membership, cleanup deletion, or other state not already captured by a durable append-only domain artifact.
- Append-only domain rows can be sufficient when they include stable IDs, timestamps, user/actor attribution, and immutable/provenance fields.
- Job rows can be sufficient for queued work only if they preserve requester/trigger context and processing outcome.
- Processor logs alone are not sufficient for durable audit unless the action is operational-only and explicitly exempted.
- Cleanup/consistency dry-run findings are operational reports; execute-mode deletions must be attributable.
- Rate-limit bucket updates from RB-111 generally do not need user-facing AuditLog entries, but should be classified explicitly.
- Export job processing from RB-112 must preserve the user who requested the export and the processor/system actor that performed it, or link to RB-115 follow-up.
- Future Core handoff must not be treated as an anonymous system write.

### 5. Follow-Up Tickets For Gaps

If the matrix identifies partial/missing coverage, create narrow follow-up tickets.

Recommended naming examples:

- `RB-116-A-audit-missing-cleanup-delete-attribution.md`
- `RB-116-B-export-job-actor-context-followup.md`
- `RB-116-C-prediction-import-audit-context-followup.md`

If a gap is already covered by RB-115-A/B/C, link that ticket instead of creating a duplicate.

Do not create broad vague tickets like `fix audit`.

## Required Coverage Areas

The matrix must explicitly cover at least:

### Project/Auth/Admin

- project creation/update/member changes if present,
- login/session mutation only if the repo audits it,
- admin/operator endpoints.

### Upload And Image Assets

- app-mediated image upload,
- compatibility presign/commit routes if still present,
- mask upload/commit routes if still present,
- image metadata changes.

### Editor / Mask / Crop Workflows

- full-image semantic mask saves,
- support mask saves,
- crop support mask saves,
- crop semantic mask saves,
- slice BBox creation/update,
- derived crop generation,
- slice classification saves,
- assisted correction saves.

### Review And Ground Truth

- review decisions,
- approval/rejection state changes,
- export eligibility changing writes if any.

### Export Workflows After RB-112

- export creation request,
- export job processing,
- export failure/retry if present,
- export download should be classified as read-only unless it mutates download tracking.

### Prediction Workflows

- prediction import batch creation/upload,
- prediction import processing,
- prediction provenance/correction writes,
- prediction-analysis export request/job.

### Cleanup / Consistency After RB-114

- cleanup dry-run,
- cleanup execute mode,
- consistency hard-drift reporting,
- deletion audit rows,
- skipped/ambiguous findings.

### Rate Limiting After RB-111

- high-cost rate-limit bucket updates,
- rate-limit hit logging if present,
- explain why they are exempt or operationally classified.

## Acceptance Criteria

- A documented audit coverage matrix exists.
- All current API mutation routes are represented or explicitly allowlisted with rationale.
- All known operational mutation scripts/workers are represented or explicitly allowlisted with rationale.
- The matrix uses ADR-007 terminology from RB-115 (`triggeredBy` / `performedBy` semantics).
- A guard test/script fails on newly added unclassified mutation routes.
- The guard passes on the current repo.
- Any missing/partial coverage is fixed if tiny or captured in focused follow-up tickets.
- RB-113 remains open unless real physical iPad evidence was separately provided.
- Existing workflows and tests remain green.

## Validation

Run:

```bash
git status --short
git diff --check
npm run lint
npm run typecheck
npm run test
npm run handoff:archive -- --dry-run
```

If only docs/tests/scripts are touched and `typecheck` or full `test` is intentionally skipped, document why. Prefer running the full suite because this ticket adds a governance guard.

## Completion Protocol

When complete:

1. Add the matrix and guard.
2. Update relevant docs/backlog entries.
3. Move this optimized RB-116 ticket to the appropriate `done/` folder.
4. Keep RB-113 open unless real iPad evidence exists.
5. Create narrow follow-up tickets for unresolved audit gaps.
6. Commit the completed slice.
7. Ensure `npm run handoff:archive -- --dry-run` passes on a clean worktree.

## Notes For Codex

- Use ADR-007 from RB-115 as the source of truth for actor terminology.
- Do not implement RB-115-A/B/C inside this ticket unless a tiny local fix is explicitly justified.
- Do not over-audit ephemeral internal state; classify it.
- Do not use processor logs alone as sufficient durable audit for business-relevant writes unless explicitly exempted.
- Keep the matrix practical and maintainable; it should help future reviews, not become a second codebase.
