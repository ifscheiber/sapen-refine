# RB-140 - Export Job Processor RBAC And Audit Alignment

Status: Planned
Priority: P2
Type: Authorization semantics / audit correctness

## Context

The RBAC policy defines an `export:processJobs` capability, but the reviewed export job processor uses create/export capabilities to decide which queued export jobs a user can process. This conflates two different responsibilities: creating exports and operating a worker.

The current repo already records worker actor context for export job processing audit events through `withAuditActorContext()`. The remaining issue is the authorization gate: `src/server/domain/exportJobs.ts` derives processable targets from `canExportTraining()` and `canExportPredictionAnalysis()` instead of a helper mapped to `export:processJobs`.

## Impact

A role may appear to have job-processing capability but be unable to process certain jobs. Conversely, future role changes could accidentally grant processing by granting create permissions. Audit events should remain explicit about the user who triggered processing and the worker identity that performed it.

## Non-goals

- Do not open export processing to unauthenticated calls.
- Do not redesign all project roles.
- Do not implement distributed queues.

## Implementation plan

1. Add or use an explicit helper such as `canProcessExportJobs(role)` mapped to `export:processJobs`.
2. Update `exportJobs.ts` to use process capability for job processing authorization.
3. Keep target-specific constraints where required, but do not use create permissions as the generic queue-processing gate.
4. Preserve existing `withAuditActorContext()` worker audit details and add tests that would fail if they are removed.
5. Update worker runbooks to state which role/account should be used.
6. Add route/capability matrix tests.

## Files to inspect

- `src/server/auth/policies.ts`
- `src/server/domain/exportJobs.ts`
- `src/server/domain/exports.ts`
- `src/app/api/export-jobs/process-due/route.ts`
- `scripts/process-export-jobs.mjs`
- `tests/unit/auth-hardening.test.ts`
- `tests/integration/export-workflow.test.ts`
- `docs/04-server/auth-rbac-audit.md`
- `docs/04-server/deployment-trial.md`

## Acceptance criteria

- `export:processJobs` is the documented and tested gate for export job processing.
- OWNER and QA behavior matches docs or docs are updated to match intended policy.
- Export job success/failure/retry audit records include clear worker context.
- Tests cover allowed and forbidden roles for processing queued exports.
- Export creation permissions remain unchanged.

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test -- tests/unit/auth-hardening.test.ts
npm run test -- tests/integration/export-workflow.test.ts
npm run check:docs-links
git diff --check
```


---

Renumbering note: This ticket was renumbered to avoid collision with Codex deep-review tickets RB-130 through RB-135.
