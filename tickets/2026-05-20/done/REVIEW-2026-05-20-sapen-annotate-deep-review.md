# Deep Review — SaPen Annotate Repository

## Review basis

Reviewed uploaded `sapen-annotate.zip` statically. I inspected repository structure, Prisma schema, app routes, server/domain modules, upload/storage helpers, editor/project UI, deployment artifacts, docs, tickets, and git status inside the extracted repository.

Important caveat: I did not run the full npm validation suite because the uploaded ZIP does not include `node_modules`. This is a static code and architecture review, not a runtime validation.

## Executive summary

The codebase has progressed very far and is now a credible standalone annotation platform baseline:

- modular App Router structure,
- versioned annotation domain schema,
- semantic/support/classification separation,
- review/approval,
- ground-truth export,
- prediction provenance/import,
- active-learning task queue,
- assisted correction,
- prediction-analysis export,
- substantial integration/E2E test coverage,
- single-host trial deployment artifacts.

The biggest current risks are no longer “missing core features” but operational hardening, UI complexity, security/RBAC/audit consistency, documentation drift, and cleanup/retention.

## Highest-priority findings

### P1 — Docs are now materially stale

Many docs still describe older state:

- `docs/00-overview/current-state.md` says active-learning queues and assisted-correction UI remain deferred, although RB-058/RB-059 are implemented.
- `docs/workflows/README.md` says queues and assisted editor UI remain deferred.
- `docs/prisma/schema.md` says batch import jobs remain deferred, while schema now contains batch models.
- `docs/prisma/README.md` says batch prediction import remains deferred.
- `docs/03-features/projects.md` says prediction import controls remain deferred, while batch import UI is present in the uploaded code.
- `docs/08-adr/remediation-backlog.md` still contains RB-061 as a proposed next step.

Codex’s RB-062 suggestion is correct and should be high priority after RB-061 state cleanup.

### P1 — Project Overview is becoming too dense

`ProjectOverview.tsx` now composes:

- project metadata,
- schema/status info,
- batch import panel,
- training export panel,
- prediction-analysis export controls,
- navigation to tasks/images.

`ProjectExportPanel.tsx` alone is already large and carries both ground-truth training export and prediction-analysis export. `ProjectPredictionImportBatchPanel.tsx` adds another operations-heavy panel.

This will become hard to use, especially on iPad. Codex’s RB-063 suggestion is correct.

Recommended direction:

Create a Project Operations area or route group:

- `/app/projects/[projectId]` = overview / status
- `/app/projects/[projectId]/images` = images
- `/app/projects/[projectId]/tasks` = correction tasks
- `/app/projects/[projectId]/exports` = ground-truth + prediction-analysis export history/actions
- `/app/projects/[projectId]/prediction-imports` = batch import operations

### P1 — RBAC is functional but scattered

Role rules are repeated across many domain modules and route handlers. Examples include direct membership checks in:

- `review.ts`
- `exports.ts`
- `predictionAnalysisExports.ts`
- `predictionImport.ts`
- `predictionImportBatches.ts`
- `correctionTasks.ts`
- several image/mask API routes.

This creates risk of policy drift:
- Training export is currently OWNER-only.
- Prediction-analysis export is OWNER/QA.
- Prediction import is OWNER/QA.
- Queue mutation has separate rules.
- Some routes use direct membership logic instead of shared helpers.

Recommended action:

Add a centralized permission/policy layer:

- `canUploadImage`
- `canAnnotate`
- `canReview`
- `canExportTraining`
- `canExportPredictionAnalysis`
- `canImportPrediction`
- `canManageCorrectionTasks`
- `canProcessBatchImport`
- `canReadProject`

Then refactor route/domain modules to use the policy layer.

### P1 — Authentication is MVP-level and not yet customer-safe

Current concerns:

- Login page still displays demo credentials (`admin@sapen.local / admin1234`).
- Seed scripts create hardcoded demo passwords.
- No login rate limiting or account lockout.
- No CSRF protection for cookie-authenticated mutation routes.
- `next` redirect parameter on login should be sanitized to same-origin app paths.
- `Session.lastSeenAt` updates on every authenticated request, causing DB write amplification.
- `session.ts` contains debug `console.error` branches that can include token material if invalid.

Recommended action before customer pilot:

- Hide demo credentials unless `NODE_ENV=development`.
- Add brute-force/rate-limit protection.
- Sanitize login `next` target.
- Add CSRF or same-origin mutation guard for API routes.
- Throttle session last-seen updates.
- Remove token-bearing debug logs.

### P1 — ZIP handoff hygiene problem

The uploaded ZIP contains:

- `.git/`
- `tsconfig.tsbuildinfo`
- `test-results/.last-run.json`

This is okay for internal review but should not be used for customer or contractor handoff by default.

Recommended action:

Create a `make handoff-zip` or documented script that excludes:

- `.git`
- `.env*` except examples
- `.next`
- `node_modules`
- coverage/test-results
- TypeScript build info
- local storage/db volumes
- screenshots/traces unless explicitly requested

### P1/P2 — Batch import needs retention and stale-processing policy

If RB-061 is completed, it creates staged batch artifacts and processing states. The current design needs follow-ups for:

- cleanup of batch ZIP/staging objects after success/failure,
- retention duration,
- manual purge,
- stale `PROCESSING` item recovery,
- heartbeat/lease semantics,
- job-runner operational path in Compose/systemd/cron,
- audit trail for job processor identity.

Codex’s RB-064/RB-065 suggestions are correct.

### P2 — Storage helpers have stale duplicate module

`src/server/storage/s3.ts` uses validated runtime config. Good.

But `src/server/storage.ts` still exists and uses direct `process.env!`. It appears unused, but it is an attractive stale import target and violates the newer runtime config pattern.

Recommended action:

Delete `src/server/storage.ts` or turn it into a re-export of `src/server/storage/s3.ts`.

### P2 — Presigned compatibility routes still exist

App-mediated uploads are now the preferred path, but presign/commit compatibility routes still exist for images/masks.

They are safer than direct public MinIO, because commit validates server-side, but they still:
- increase attack surface,
- may leave orphan objects if never committed,
- create two upload pathways to maintain,
- weaken the simple “all uploads through app route” mental model.

Recommended action:

Either:
- remove presigned compatibility routes if no longer needed,
- or feature-flag them and document cleanup/retention for orphaned presigned objects.

### P2 — Export generation is synchronous and memory-heavy

Training export and prediction-analysis export both build ZIPs synchronously using JSZip and load objects into memory.

That is acceptable for trial-sized datasets, but risky for larger customer datasets.

Recommended action:
- enforce export size/item limits,
- show user-facing warning,
- add future background export ticket,
- consider stream-based ZIP generation later.

### P2 — Slice model is still single-default-slice oriented

The current slice flow uses “first/default slice instance” semantics. Schema can store multiple `SliceInstance` rows, but workflow and metadata remain default/image-level.

Known limitation is documented, but this will matter if real customer images contain multiple slices needing separate support geometry/classification/metadata.

Recommended action:
- defer until customer workflow confirms need,
- but define a future normalized sample/specimen/slice data model before heavy multi-slice UI.

### P2 — EditorClient is very large

`src/features/editor/EditorClient.tsx` is ~1700 lines. It now owns too many concerns:

- drawing tools,
- semantic/support modes,
- review controls,
- slice classification,
- assisted correction,
- saving,
- dirty state,
- overlay/rendering,
- task context.

It works, but future changes will become risky.

Recommended action:
Split incrementally after current feature chain stabilizes:
- editor state reducer/hooks,
- canvas layer/rendering component,
- toolbar/tools component,
- review/status panel,
- correction context panel,
- save/commit service wrapper.

Do not rewrite in one large ticket.

### P2 — E2E is valuable but too monolithic

`tests/e2e/desktop-browser-smoke.spec.ts` covers a huge path:
login, project creation, upload, metadata, editor, support mask, classification, review, export, prediction import, task queue, assisted correction.

That is a great golden path, but also brittle and slow.

Recommended action:
Keep it, but add smaller E2E smoke specs:
- `manual-annotation-smoke`
- `review-export-smoke`
- `prediction-assisted-smoke`
- `batch-import-smoke` after RB-061

### P2 — Audit is useful but incomplete and stringly typed

AuditLog exists and write actions are recorded, but:
- action strings are not enum-controlled,
- coverage is incomplete across all mutations,
- actor/system identity for job runner needs clarification,
- audit querying UI does not exist.

Recommended action:
Create an Audit/RBAC hardening ticket after docs/project-ops cleanup.

### P2 — Filename/header sanitization

`/api/images/[imageId]/asset` sets `Content-Disposition` with raw filename in quotes. Filenames are partially sanitized at upload, but quotes/control characters should still be handled defensively.

Recommended action:
Use robust content-disposition encoding or sanitize quotes/control chars.

## Recommended next tickets

### RB-062 — Repository State & Documentation Consistency Sweep

This should be next, but only after RB-061 state is resolved.

Scope:
- verify clean git status,
- remove duplicate active RB-061 tickets,
- update docs that still describe implemented features as deferred,
- update Architecture current-state,
- update docs/prisma, docs/workflows, docs/testing,
- ensure docs/08-adr and docs/adr backlog are consistent.

### RB-063 — Project Operations UX Split

Scope:
- split Project Overview operations into clear routes/panels,
- avoid dense page on iPad,
- likely add `/exports` and `/prediction-imports` project subroutes,
- keep overview as high-level status only.

### RB-064 — Auth, RBAC & Audit Hardening

Scope:
- central permission policy,
- remove scattered role logic,
- add login hardening/rate limit,
- sanitize next redirect,
- hide demo credentials in non-dev,
- audit mutation coverage,
- worker/system actor model.

### RB-065 — Batch Import Runner Hardening

Scope:
- process job runner path for Compose/systemd/cron,
- lease/heartbeat/stale processing recovery,
- processor identity,
- operational docs.

### RB-066 — Batch Staging Retention & Cleanup

Scope:
- storage lifecycle for batch ZIP/staging objects,
- orphan cleanup for presigned uploads,
- manual purge docs/API,
- retention policy.

### RB-067 — Export & Prediction Metrics/QA

Scope:
- optional comparison metrics for prediction-analysis exports,
- clear non-ground-truth labeling,
- no changes to default training export.

### RB-068 — Editor Decomposition

Scope:
- split `EditorClient.tsx` incrementally,
- no behavior changes initially,
- preserve E2E.

## Recommended immediate sequence

1. RB-062 docs/state consistency sweep.
2. RB-063 project operations UI split.
3. RB-064 auth/RBAC/audit hardening.
4. RB-065/RB-066 job runner + retention cleanup.
5. Then real customer-trial deployment/manual iPad smoke.
