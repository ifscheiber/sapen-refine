# SaPen Annotate Deep Repository Review

**Repository reviewed:** `sapen-annotate.zip` extracted to `/mnt/data/sapen-annotate-review/sapen-annotate`  
**Git HEAD in archive:** `2f05e1b` — `test: close out RB-098 crop workflow smoke coverage` — `2026-05-23 22:22:56 +0200`  
**Review date:** 2026-05-23  
**Reviewer role:** architecture/code/documentation reviewer for SaPen Annotate

---

## 1. Executive Summary

The repository is substantially more mature than a pure prototype. The current implementation already contains a sizeable standalone SaPen Annotate application with:

- Next.js App Router browser routes and 70 API route handlers.
- Prisma 7/PostgreSQL persistence for projects, roles, label schemas, images, annotation artifacts, crop workflows, classification versions, review decisions, exports, model/prediction provenance, batch imports, audit logs, login throttling, and sessions.
- S3/MinIO object storage helpers with object stat verification and cleanup support.
- A crop-first multi-slice annotation workflow with BBox planning, derived crops, support masks, semantic masks, semantic-family exclusivity guards, crop-derived classification suggestions, and review/export readiness logic.
- Prediction-assisted correction and batch prediction import workflows as secondary modes.
- Broad test coverage across unit/integration/e2e directories.
- A handoff archive script that is well-designed to exclude `.git`, `.env*`, build artifacts, reports, traces, and local volumes.

The main review conclusion is therefore **not** that the implementation is weak. The main risk is **documentation/source-of-truth drift and production hardening debt around archive hygiene, stale route documentation, operational safety, concurrency, and large-job handling**.

The most urgent items are:

| Priority | Finding | Why it matters |
|---|---|---|
| **P0/P1** | The uploaded handoff ZIP contains `.env`, `.env.local`, and `.git`, although the repository contains a script and checklist that explicitly exclude them. | This is a secrets/process hygiene issue. Even local credentials should not travel in review/customer archives, and `.git` bloats and leaks history/config. |
| **P1** | `ARCHITECTURE.md` still documents the removed legacy `/edit` product route, while `docs/src/app/routes.md` correctly says RB-104 removed it. | A reviewer or implementer following the root architecture map will open/build against a dead route. |
| **P1** | ADR/backlog documentation is split between `docs/adr`, `docs/08-adr`, and `docs/architecture/decisions`, with a canonical backlog in one place and ADRs in another. | The repo has a documented canonical direction, but contributors can still update the wrong place or miss the active backlog. |
| **P1** | `docs/README.md` links to non-existing `src/app/README.md`, `src/server/README.md`, etc.; actual docs live under `docs/src/...`. | The main documentation index contains broken links at the exact point where new reviewers will navigate. |
| **P1/P2** | Artifact/classification/crop versioning often uses “read latest version, then insert version + 1”. Unique indexes protect data, but concurrent saves can race and surface as avoidable 500/P2002 errors unless retried or serialized. | Multi-tab or multi-user annotation on the same artifact can become flaky under real production usage. |
| **P2** | Several important domain invariants are enforced in service code but not by database constraints, especially “review decision targets exactly one thing” and export item role/reference consistency. | DB-level protection would reduce corruption risk from future bugs, scripts, or manual maintenance. |
| **P2** | Upload/export/import processing is still mostly request-sized and route/server-process bounded, with known sync/large-job limitations. | Fine for customer trial limits, but not production-scale or multi-tenant usage without workers, rate limits, and operational observability. |

The remainder of this report gives the detailed evidence, stale-doc analysis, production issue list, and improvement recommendations.

---

## 2. Scope, Method, and Limitations

### 2.1 Files and commands inspected

I reviewed the repository from the uploaded ZIP directly. I started with the required entry points:

- `AGENTS.md`
- `ARCHITECTURE.md`

Then I inspected the documentation tree and production code:

- `docs/**`
- `src/app/**` browser routes and API routes
- `src/features/**` UI/workflow composition
- `src/server/**` auth, domain services, runtime config, storage, upload validation
- `src/mask/**` label/mask helpers
- `prisma/schema.prisma`
- `scripts/**`
- `tests/**`
- `tickets/**`

Repository counts from the archive:

| Area | Count |
|---|---:|
| All files in extracted ZIP, including `.git` internals | 5,029 |
| Git-tracked files | 503 |
| API `route.ts` handlers | 70 |
| Browser `page.tsx` routes | 22 |
| Test files under `tests/` | 50 |

### 2.2 Validation commands attempted

| Command | Result |
|---|---|
| `git status --short` | Clean worktree in the extracted repository. |
| `npm run check:design-hardcoding` | Passed. This script can run without `node_modules` because it uses `rg`. |
| `npm run lint -- --help` | Failed with `eslint: not found` because `node_modules` was removed from the handoff ZIP. |
| Full `lint`, `typecheck`, `test`, `build`, Playwright | Not executable in this archive without installing dependencies and setting up database/storage. |

### 2.3 Review limitation

Because `node_modules`, `.next`, and runtime services were intentionally absent, this review is a **static/deep code and documentation review**, not a full runtime verification. I did not execute the app against PostgreSQL/MinIO, did not run Prisma migrations, and did not run the full test suite. Where I identify runtime risks, they are based on code path inspection and database model inspection.

---

## 3. Repository Orientation and Architectural Reading

### 3.1 AGENTS.md: intended product and contribution rules

`AGENTS.md` positions SaPen Annotate as a standalone annotation application for creating attributable, exportable ground-truth data. Its stated primary purpose is to annotate heartwood/sapwood masks, copper masks, slice/type/classification labels, image/acquisition metadata, maintain attribution/version history, and export reviewed datasets for model training.

Important architectural rules from `AGENTS.md`:

- **URL-first architecture:** all workflows should be route-addressable and not hidden in client-only state.
- **Backend as source of truth:** annotation state, roles, metadata, masks, reviews, and exports live in DB/API state.
- **Ground-truth integrity:** raw images immutable, mask versions append-only, approved/historical masks not overwritten, reproducible exports.
- **Attribution by design:** every annotation, mask commit, review, approval, export, and administrative action must be attributable.
- **Evidence-backed documentation:** architecture facts should reference real paths and planned/future behavior must be marked as such.
- **Reuse before rebuild:** check existing routes/layouts/APIs/storage helpers before adding new ones.

These principles are generally visible in the production code: many route handlers are thin, project membership is checked server-side, artifact versions are append-only, label schemas are versioned, review decisions are persisted, and storage keys are generally not exposed directly to the browser.

### 3.2 ARCHITECTURE.md: current implementation map

`ARCHITECTURE.md` is fairly current in many areas. It accurately describes:

- App/feature/server/mask/storage/auth boundaries.
- Prisma 7/PostgreSQL and S3-compatible storage.
- Local login/session handling.
- The current persisted model: projects, memberships, label schemas, image assets, artifact versions, crop workflow entities, review/export/audit, model/prediction provenance, batch import bookkeeping.
- Crop workflow surfaces and API routes.
- Review/export and prediction import/provenance routes.
- Known limitations around large jobs, dashboards, cleanup, and production queue infrastructure.

However, it also contains one high-impact stale flow statement: it still says the editor opens at `/app/projects/[projectId]/images/[imageId]/edit`, while the actual route has been removed and the docs/routes page explicitly says RB-104 removed it. This is documented in detail below.

### 3.3 Production code shape

The implementation is organized coherently:

| Layer | Observed role |
|---|---|
| `src/app` | Next.js App Router pages and API handlers. Browser pages are mostly composition points. |
| `src/features` | Project/image/editor workflow UI. Crop workflow UI is here. |
| `src/server/auth` | Session cookies, DB sessions, project role checks, policy helpers, request guards. |
| `src/server/domain` | Business/domain services for crop workflow, masks, review, exports, prediction import, storage cleanup, metadata, etc. |
| `src/server/storage` | S3/MinIO helpers for app-mediated reads/writes, object stats, cleanup. |
| `src/server/uploads` | Upload size/integrity checks for image/mask/batch uploads. |
| `src/mask` | Label constants, mask serialization, operations, overlay rendering. |
| `prisma/schema.prisma` | Actual persisted domain model. |
| `scripts` | handoff archive, trial bootstrap, batch processing, storage cleanup, user creation. |

This is consistent with the architecture principles and generally easier to review than an app that buries business rules inside React components.

---

## 4. Strengths and Positive Findings

### 4.1 Stronger-than-average route-addressed workflow discipline

The current browser route documentation under `docs/src/app/routes.md` matches the actual `src/app` route tree closely. The crop workflow is route-addressable:

- `/app/projects/[projectId]/images/[imageId]/crop`
- `/crop/bboxes`
- `/crop/slices`
- `/crop/slices/[sliceInstanceId]`
- `/crop/slices/[sliceInstanceId]/crops/[cropId]`
- `/crop/slices/[sliceInstanceId]/crops/[cropId]/support`
- `/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic`

This aligns with AGENTS’ URL-first principle.

### 4.2 Server-side RBAC is consistently present

`src/proxy.ts` protects non-public routes at session-cookie level and rejects unsafe cross-site API mutations using same-origin request guards. Public routes are limited to login/auth, health/ready, static assets, and manifests.

Project-level operations generally use `requireProjectRole()` or domain-level membership checks. Role policy helpers define readable/editable/review/export/model-import capabilities centrally:

- Read: `OWNER`, `QA`, `LABELER`, `VIEWER`
- Manage/review/import: mostly `OWNER`, `QA`
- Annotate/upload: `OWNER`, `QA`, `LABELER`
- Training export: `OWNER`
- Model run creation: global `ADMIN`

This is a good foundation for a trial/customer deployment.

### 4.3 Good artifact model for annotation provenance

`AnnotationArtifact` and `AnnotationArtifactVersion` are modeled with clear identities:

- Artifact uniqueness by `(imageId, kind, scopeKey)`.
- Version uniqueness by `(artifactId, version)`.
- Version metadata includes `reviewState`, `provenance`, `storageKey`, `checksum`, dimensions, coordinate space, label schema version, crop/slice lineage, support-mask relationship, task/session/parent lineage, and creator.

This gives the implementation a credible base for reproducible exports and reviewability.

### 4.4 Crop coordinate-space and support/semantic separation are well represented

The schema and domain services separate:

- source-image BBox proposals,
- derived slice crops,
- crop support masks,
- crop semantic masks,
- semantic-family mode,
- auto-derived/manual slice classification versions,
- support-mask lineage and crop lineage.

This is the correct direction for wood-slice annotation because semantic masks and geometric support masks should not be conflated.

### 4.5 Upload integrity checks are not superficial

The app-mediated image upload route validates:

- `content-length` pre-check where available,
- actual body size after reading,
- PNG/JPEG content type,
- PNG/JPEG dimensions from bytes,
- SHA-256 checksum where supplied,
- trial editability size limits,
- object write plus object stat verification before creating the DB image row.

Mask validation enforces `u8raw-v1`, width/height, byte length, optional dimension match, checksum, and support-mask value constraints. This is significantly stronger than trusting file extensions or browser-provided metadata.

### 4.6 Handoff tooling is correctly designed, even though the supplied ZIP did not follow it

`scripts/create-handoff-archive.mjs` explicitly excludes `.git`, `.env` and `.env.*` except examples, `node_modules`, `.next`, build/dist/out, coverage, test-results, Playwright reports, tsbuildinfo, local storage volumes, logs, screenshots, traces, videos, and backups.

`docs/operations/handoff-zip-checklist.md` repeats the same policy and recommends `npm run handoff:archive`.

This is a good process design. The issue is that the reviewed uploaded archive was not created with that process.

---

## 5. Stale Documentation and Source-of-Truth Drift

### DOC-001 — `ARCHITECTURE.md` still documents the removed legacy `/edit` route

**Severity:** P1  
**Evidence:**

- `ARCHITECTURE.md` says: `Editor open: /app/projects/[projectId]/images/[imageId]/edit checks project role and renders src/features/editor/EditorClient.tsx`.
- Actual browser route list has no `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx`.
- `docs/src/app/routes.md` explicitly says RB-104 removed the legacy `/app/projects/[projectId]/images/[imageId]/edit` product route and old links now fall through to workspace not-found behavior.
- `docs/08-adr/ADR-006-crop-workflow-ux-orchestration.md` also says RB-104 removes the legacy full-image editor route, but its evidence section still references the removed file path as “Removed full-image editor route”.

**Risk:**

This is the most concrete stale-doc issue because `ARCHITECTURE.md` is the root architecture map. A reviewer, future Codex run, or integration developer may open or generate links to `/edit` and believe `EditorClient.tsx` is still the product editor entrypoint.

**Recommendation:**

Update `ARCHITECTURE.md` current flows:

- Replace the `/edit` statement with the current crop entry and crop workbench routes.
- Explain that `EditorClient.tsx` remains as a lower-level canvas/editor component only where actually used, not as the legacy product route.
- Mention assisted correction separately: `/app/projects/[projectId]/tasks/[taskId]/correct`.
- Add a short “removed routes” note only if useful, but not in the primary current-flow list.

---

### DOC-002 — ADR and backlog source of truth is split across three places

**Severity:** P1  
**Evidence:**

- `AGENTS.md` instructs agents to add missing items to `docs/adr/remediation-backlog.md`.
- `docs/adr/README.md` calls `docs/adr` the operational ADR/backlog entry point expected by AGENTS.md.
- `docs/08-adr/README.md` says the canonical remediation backlog lives in `docs/adr` and ADR files are split between `docs/architecture/decisions` and `docs/08-adr`.
- `docs/08-adr/remediation-backlog.md` is a stub redirecting to `../adr/remediation-backlog.md`.
- Actual ADRs live in both `docs/architecture/decisions/` and `docs/08-adr/`.

**Risk:**

The repository documents the intended canonical location, but the physical structure still invites drift. Codex/human contributors may update the stub or create another backlog in the wrong folder. ADR history vs. live backlog is not as crisp as the rest of the architecture deserves.

**Recommendation:**

Pick one of these patterns and enforce it:

1. **Canonical ADR folder:** move ADRs into `docs/adr/` and leave `docs/08-adr` as a redirect-only archive; or
2. **Numbered docs structure:** keep ADRs in `docs/08-adr`, keep backlog in `docs/adr`, but remove the `docs/08-adr/remediation-backlog.md` stub and add a prominent “no backlog here” statement.

Also add a docs CI check that fails if a file named `remediation-backlog.md` appears outside the canonical location, unless it is explicitly whitelisted.

---

### DOC-003 — `docs/README.md` contains broken module links

**Severity:** P1  
**Evidence:**

`docs/README.md` links to:

- `src/app/README.md`
- `src/server/README.md`
- `src/mask/README.md`
- `src/components/README.md`
- `src/lib/README.md`
- `prisma/README.md`
- `testing/README.md`

These files do not exist at those paths in the extracted repository. The actual implementation docs are:

- `docs/src/app/README.md`
- `docs/src/app/api.md`
- `docs/src/app/routes.md`
- `docs/src/server/README.md`
- `docs/src/server/auth.md`
- `docs/src/server/storage.md`
- `docs/src/mask/README.md`
- `docs/src/components/README.md`
- `docs/src/lib/README.md`

**Risk:**

This is high-friction for the exact workflow the user requested: reviewers start at `AGENTS.md`/`ARCHITECTURE.md` and then follow docs. Broken links weaken trust in otherwise detailed documentation.

**Recommendation:**

Fix the links in `docs/README.md` lines 55–61 to `docs/src/...` paths or create real README files at the linked implementation paths if that was intended. Add a markdown link checker to CI.

---

### DOC-004 — `AGENTS.md` product-scope wording is slightly stale around prediction assistance

**Severity:** P2  
**Evidence:**

`AGENTS.md` says “Future extensions” include assisted annotation from model pre-predictions, uncertainty/ranking-based correction queues, and Core-to-Annotate handoff workflows. It also says Core correction and pre-prediction workflows are “future/secondary modes”.

`ARCHITECTURE.md` says the current MVP already supports model/prediction-run provenance persistence, server-side prediction mask import, assisted correction, prediction-analysis exports, and ZIP-backed batch prediction imports. Current routes also include prediction imports and correction tasks.

**Risk:**

This is not a catastrophic mismatch because `AGENTS.md` also says “future/secondary modes”. But it is ambiguous: some prediction-assisted functionality is no longer purely future. A future Codex run could incorrectly avoid modifying existing prediction-assist code because it interprets it as not implemented or out of scope.

**Recommendation:**

Update `AGENTS.md` to distinguish:

- **Implemented secondary mode:** prediction import/provenance, correction tasks, assisted correction, prediction-analysis export.
- **Still future:** explicit SaPen Core handoff, uncertainty ranking beyond current task queue, any deep Core integration.

---

### DOC-005 — Historical backlog references to removed files need clearer labeling

**Severity:** P3  
**Evidence:**

Several documentation/backlog files reference removed or legacy paths such as:

- `src/server/storage.ts` — removed by RB-069, while `ARCHITECTURE.md` correctly says active storage is `src/server/storage/s3.ts`.
- `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx` — removed by RB-104.
- `src/features/editor/EditImagePage.tsx` and other earlier editor surface names.

Some of these are historical references inside resolved tickets or ADR evidence, not necessarily incorrect. The problem is that historical references are not visually distinct from current implementation paths in all places.

**Risk:**

A reviewer or agent can chase dead paths and misdiagnose missing files as accidental deletions.

**Recommendation:**

Use an explicit convention in ADRs/backlogs:

- `Current path:` for current production files.
- `Historical path:` for intentionally removed/replaced files.
- `Removed by:` with ticket/commit if known.

For ADR-006, change “Removed full-image editor route: `.../edit/page.tsx`” to “Historical path removed by RB-104: `.../edit/page.tsx`”.

---

### DOC-006 — Known gaps should be pruned after RB-096/RB-098/RB-103/RB-104

**Severity:** P2/P3  
**Evidence:**

`ARCHITECTURE.md` still lists “crop-aware exports/review integration” as a known workflow gap. The current implementation and docs show substantial crop review/readiness/export logic:

- Crop semantic/support mask routes.
- Crop readiness resolver.
- Review decisions for artifact versions and slice classifications.
- Export logic that includes crop candidates and crop metadata.
- RB-096/RB-097/RB-098/RB-103/RB-104 docs showing the crop workflow closeout.

**Risk:**

The phrase may be partially true if it means “advanced reviewer dashboard/bulk review/history,” but it reads as if crop-aware review/export integration is broadly missing. That underrepresents the implementation and could cause duplicate tickets.

**Recommendation:**

Split the known gap into precise remaining gaps, for example:

- “Reviewer dashboard and bulk review UX missing.”
- “Export history dashboard missing.”
- “Advanced export filters/history/async large-job handling missing.”
- “Crop-aware export itself exists for approved/current crop candidates.”

---

## 6. Production-Code Findings and Risks

### PROD-001 — Handoff archive contains `.env`, `.env.local`, and `.git`

**Severity:** P0/P1  
**Evidence:**

The extracted ZIP contains:

- `.env`
- `.env.local`
- `.git/`

The `.env` and `.env.local` files contain local database and S3/MinIO configuration keys. I am not reproducing their values in this report.

This contradicts:

- `scripts/create-handoff-archive.mjs`, which excludes `.git/`, `.env and .env.* except example templates`, `deploy/*.env`, `node_modules/`, `.next/`, build output, test results, traces, and local volumes.
- `docs/operations/handoff-zip-checklist.md`, which explicitly says not to include `.env`, `.env.local`, other real secret files, `.git`, local DB/storage volumes, build output, Playwright reports, or test traces.

`git ls-files` confirms `.env` and `.env.local` are not tracked, while `.env.example` is tracked. So the repository’s git hygiene is fine; the handoff packaging was the issue.

**Risk:**

Even if these are only local development credentials, this is a bad production/customer-review habit. In real customer deployments this can leak secrets. Including `.git` can leak commit history, branch names, remote config, local metadata, and greatly inflate archive size.

**Recommendation:**

- Use `npm run handoff:archive` for all future review/customer archives.
- Add a pre-upload checklist step: inspect ZIP root for `.env`, `.env.local`, `.git`, `.next`, `node_modules`, `test-results`, `playwright-report`.
- Consider adding a `scripts/validate-handoff-archive.mjs` script that can scan an arbitrary ZIP and fail if forbidden paths exist.
- Treat the current uploaded archive as internal-only and do not reuse it for customer or external review.

---

### PROD-002 — Concurrent version creation can race

**Severity:** P1/P2  
**Evidence:**

The schema has good unique constraints such as:

- `AnnotationArtifactVersion @@unique([artifactId, version])`
- `SliceClassificationVersion @@unique([sliceInstanceId, version])`
- `SliceBoundingBoxVersion @@unique([sliceInstanceId, version])`
- Derived crop versioning by source/slice/BBox context.

However, multiple domain/API paths compute the next version using the pattern:

1. find latest version ordered by `version desc`,
2. insert version `(latest?.version ?? 0) + 1`.

Observed examples include:

- `src/server/domain/sliceCrops.ts`
- `src/server/domain/slices.ts`
- `src/server/domain/predictionImport.ts`
- `src/server/domain/sliceClassifications.ts`
- `src/server/domain/assistedCorrection.ts`
- `src/server/domain/cropSupportMasks.ts`
- `src/server/domain/cropSemanticMasks.ts`
- `src/app/api/images/[imageId]/mask/upload/route.ts`
- `src/app/api/images/[imageId]/mask/commit/route.ts`

Some of these are inside transactions; that does not automatically serialize concurrent reads in PostgreSQL unless row locking, serializable isolation, advisory locks, or retry logic is used.

**Risk:**

Two browser tabs or two users can save the same artifact/crop/classification concurrently. Both compute the same next version, one succeeds, the other hits a unique violation. Depending on error handling, that may surface as a 500 rather than a user-friendly retry.

**Recommendation:**

Introduce a shared version-allocation helper:

- For each versioned scope, perform allocation in a transaction.
- Catch Prisma unique constraint errors (`P2002`) and retry a bounded number of times.
- Prefer a single helper per scope type so fixes do not need to be duplicated.
- For high-write scopes, consider a `VersionCounter` table or PostgreSQL advisory locks keyed by scope ID.
- Add a targeted concurrency test for two parallel commits to the same artifact/slice/crop.

---

### PROD-003 — Some invariants are service-enforced but not DB-enforced

**Severity:** P2  
**Evidence:**

The schema allows nullable alternatives in several important models:

- `ReviewDecision` has nullable `artifactVersionId` and nullable `sliceClassificationVersionId`. Domain code creates exactly one or the other, but there is no database `CHECK` constraint enforcing “exactly one target”.
- `ExportItem` has nullable `imageId`, `artifactVersionId`, `sliceClassificationVersionId`, `predictionProvenanceId`, `derivedCropId`, plus a free-text `role`. Domain code likely controls valid combinations, but the DB does not.

**Risk:**

Application code is currently disciplined, but future scripts, migrations, manual maintenance, or accidental code paths could create ambiguous review/export rows. Those are hard to repair later because they affect auditability and export reproducibility.

**Recommendation:**

Add DB-level constraints through raw SQL migrations where Prisma schema cannot express the invariant:

- `ReviewDecision`: exactly one of `artifactVersionId`, `sliceClassificationVersionId` must be non-null.
- `ExportItem`: permitted role/reference combinations should be constrained, or `role` should become a typed enum with allowed target reference patterns.
- Consider constraint tests that intentionally try to insert invalid rows and assert DB rejection.

---

### PROD-004 — Upload and ZIP processing buffer request bodies in server memory

**Severity:** P2  
**Evidence:**

The image upload route reads the full request body via `await req.arrayBuffer()` and then validates size/integrity. Mask and prediction-batch paths follow similar route-mediated body processing. Runtime defaults allow:

- image upload max: 100 MB,
- mask upload max: 50 MB,
- prediction batch upload max: 100 MB,
- prediction batch max items: 200,
- batch process limit: 25.

The route does pre-check `content-length` when present and validates actual byte length, which is good. The risk is still that request bodies are loaded into the application process.

**Risk:**

For the current single-host customer trial this may be acceptable, but production or multi-user usage can produce memory pressure or slow request workers. A malicious or buggy client can omit/lie about `content-length`, forcing body read up to server/proxy limits.

**Recommendation:**

- Keep current limits for trial, but document them as trial limits, not production architecture.
- Add reverse-proxy request body limits consistent with app limits.
- For production, prefer direct-to-object-storage multipart uploads or streaming parsers with early abort.
- Add per-user/project upload rate limits and quota accounting.
- Add operational metrics around rejected uploads, body sizes, and memory usage.

---

### PROD-005 — General API write rate limiting is not yet present

**Severity:** P2  
**Evidence:**

Login throttling exists through `AuthLoginThrottle` and runtime login rate-limit config. Same-origin mutation guards exist in `src/proxy.ts`. I did not find a general request rate limiter for authenticated write-heavy endpoints such as image uploads, mask commits, exports, batch imports, prediction processing, or cleanup actions.

**Risk:**

Authenticated users, browser bugs, repeated retries, or malicious clients can generate high write load. Same-origin protection does not solve authenticated abuse or accidental runaway requests.

**Recommendation:**

- Add per-user/project rate limits for high-cost endpoints.
- Add stricter limits for upload, export creation, batch import creation/processing, and cleanup.
- Add response codes and UI handling for rate-limited states.
- Record rate-limit events in audit/ops logs.

---

### PROD-006 — Object storage and DB writes are best-effort consistent, not transactionally atomic

**Severity:** P2  
**Evidence:**

The image upload path writes the object, verifies object stat, creates DB row, and deletes the object best-effort on error. Similar patterns are common in object-storage apps. The repository also contains storage cleanup tooling, which is good.

**Risk:**

A process crash or network interruption between object write and DB commit can still leave orphaned objects. The reverse can also happen in some flows if DB state is created but object visibility later fails. The cleanup job reduces but does not eliminate the operational need to monitor drift.

**Recommendation:**

- Treat object cleanup as an operational requirement, not an optional maintenance script.
- Add a scheduled cleanup path for the trial deployment and document how it is run.
- Add metrics/summary output: objects scanned, DB-linked objects, orphan candidates, deleted objects, bytes reclaimed.
- Consider an outbox/staging pattern for production: object enters staging, DB record confirms, background job promotes or purges.

---

### PROD-007 — Async job infrastructure is present but still trial-sized

**Severity:** P2  
**Evidence:**

The runtime config and scripts include prediction batch worker settings:

- lease seconds,
- max jobs per tick,
- worker interval,
- processor ID,
- batch item attempts,
- cleanup retention.

This is a pragmatic single-host/trial runner. `ARCHITECTURE.md` also identifies production-scale queue infrastructure beyond the current single-host trial worker as a known gap.

**Risk:**

For real production, batch imports, exports, model/prediction analysis, and cleanup should not depend on route calls or single-process polling alone. Without robust queue semantics, retries, visibility timeouts, dashboards, and idempotency, long-running tasks become hard to operate.

**Recommendation:**

- Keep current runner for trial.
- For production, define a job table/queue contract with idempotency keys, worker identity, retry/backoff, dead-letter states, progress reporting, and admin observability.
- Move large exports and prediction-analysis exports into that queue.

---

### PROD-008 — Service/system actor model is not fully explicit

**Severity:** P2/P3  
**Evidence:**

`AGENTS.md` allows attribution to an authenticated user or explicitly identified system actor. The schema and code mostly attribute actions to `User` rows. Batch processing has a `processorId` concept and some jobs have nullable `createdById`, but the system actor concept is not as uniformly explicit as user attribution.

**Risk:**

As soon as scheduled workers, cleanup jobs, prediction processors, or Core handoff automation become more prominent, “who did this?” becomes ambiguous unless system actors are first-class and audit-visible.

**Recommendation:**

- Define a formal system actor strategy: either special `User` rows, a separate `Actor` abstraction, or explicit audit actor type fields.
- Ensure cleanup, scheduled batch processing, automatic classification derivation, supersede operations, and future Core handoffs have unambiguous actor/provenance.
- Extend audit log schema if necessary.

---

### PROD-009 — Image file validation does not equal full malware/content safety

**Severity:** P2/P3, depending on deployment exposure  
**Evidence:**

The upload route validates content type, byte-level PNG/JPEG dimensions, checksum, and size. That is good. It does not fully decode/re-encode images, scan for malware, strip metadata, or sandbox processing.

**Risk:**

For an internal/trial environment this may be acceptable. For internet-exposed customer uploads, image parsers and metadata can be an attack surface, especially if downstream processing uses native libraries.

**Recommendation:**

- Put uploads behind authenticated sessions and reverse-proxy size limits, as already intended.
- For production, add malware scanning or a controlled decode/re-encode pipeline.
- Consider stripping EXIF/metadata if not needed.
- Keep image processing libraries up to date.

---

### PROD-010 — Trial/mobile browser boundary should remain explicit

**Severity:** P3  
**Evidence:**

The repository has desktop-first/iPad-deferred ADRs and iPad smoke/gate docs. The app also has trial image editability limits, including large/unsupported image states. This is good. However, the editor/canvas workflow is still inherently browser-memory-heavy.

**Risk:**

Users may assume iPad/tablet use is production-supported because there are iPad docs and viewport tests. Unless manual Safari validation is completed, this can produce support issues in customer trials.

**Recommendation:**

- Keep the docs clear: desktop browser is the supported baseline; iPad is a gated/deferred target unless the manual smoke gate passes.
- Add a visible UI warning for unsupported browsers/image sizes if not already present.
- Keep canvas memory budget and image dimension policy aligned with actual Safari testing.

---

## 7. Security, Auth, and Audit Review

### 7.1 Positive findings

- Non-public routes require session cookies through `src/proxy.ts`.
- Unsafe API methods are guarded against cross-site mutation using request origin/fetch metadata logic.
- API handlers and domain services consistently check user/project membership for protected resources.
- Role policy helpers are centralized.
- Login throttling exists.
- Storage keys are generally hidden behind app-mediated asset routes.
- Many important events call `recordAuditEvent()`, including login attempts, image uploads, mask uploads, BBox/crop/classification changes, review decisions, exports, prediction imports, cleanup, and project changes.

### 7.2 Remaining security/audit concerns

1. **Archive/secrets hygiene is currently the most urgent security process issue.** The repo itself ignores env files, but the uploaded ZIP included them.
2. **General API write rate limiting is not implemented.** Login throttling alone is insufficient for upload/export/batch endpoints.
3. **Audit coverage is broad but not machine-enforced.** I found many `recordAuditEvent()` calls, including review decisions, so the implementation is much better than a simple MVP. The remaining risk is that future mutation paths can be added without audit events unless there is a testable audit-coverage matrix.
4. **System actor semantics need to mature before background workers/Core handoffs expand.**

### 7.3 Recommended security hardening tickets

- Add archive validation script and CI/preflight guard for forbidden handoff paths.
- Add rate limiting for high-cost authenticated writes.
- Add audit coverage tests: every mutation route/domain action must either call `recordAuditEvent()` or explicitly document why domain rows are sufficient evidence.
- Add DB constraints for review/export invariants.
- Add system actor model ADR and implementation slice.

---

## 8. Data Model and Domain Integrity Review

### 8.1 Strong areas

The Prisma schema has a solid domain foundation:

- Project membership has compound identity by project/user.
- Images have unique storage keys and belong to projects.
- Label schema versions and label definitions are versioned and constrained.
- Artifact versions are append-only by `(artifactId, version)` and link to label schema/version/provenance/coordinate-space/storage.
- Slice BBox versions and derived slice crops are versioned.
- Classification versions have source/provenance and can link to semantic/support mask sources.
- Review decisions and export batches/items are persisted.
- Prediction provenance and batch import bookkeeping are substantial.

### 8.2 Main data-integrity gaps

The biggest data-integrity gap is not missing tables; it is that some invariants are not pushed down into the DB. Application code is currently responsible for exact-one-target and role/reference consistency. This is acceptable early, but production auditability benefits from DB constraints.

Recommended DB-level candidates:

| Model | Constraint to consider |
|---|---|
| `ReviewDecision` | Exactly one of `artifactVersionId` or `sliceClassificationVersionId` is non-null. |
| `ExportItem` | Role/reference combinations are valid; possibly use enum for `role`. |
| `AnnotationArtifactVersion` | Crop semantic masks should have crop fields/mode/support linkage according to kind/provenance. Some of this may remain service-level due complexity. |
| `SliceClassificationVersion` | Source-specific required lineage: auto-from-semantic should require `derivedFromSemanticMaskVersionId`; manual overrides should not. |
| `PredictionArtifactProvenance` | Target type should align with artifact/classification/image/slice fields. |

Do not over-constrain everything in the first pass; start with low-risk check constraints that encode obvious invariants.

---

## 9. API and Workflow Review

### 9.1 API route coverage

I counted 70 API `route.ts` handlers. `docs/src/app/api.md` appears to cover the actual API route set; I did not find actual API routes missing from that specific API document in the script-based comparison.

The route-handler shape is generally good:

- API handlers are thin.
- They call RBAC helpers or domain services.
- Domain services perform deeper invariants.
- Errors are often wrapped through shared API error handling.
- App-mediated asset streaming avoids exposing raw storage keys.

### 9.2 Browser route coverage

The browser route docs are more current than `ARCHITECTURE.md`. `docs/src/app/routes.md` correctly describes the crop workflow and the removal of the old `/edit` route.

### 9.3 Workflow concerns

The workflow implementation has become sophisticated. The main production concern is not lack of capability, but the complexity of states:

- BBox set: draft/confirmed/needs update.
- Crops: current/stale/missing.
- Support mask: required/optional depending on semantic mode.
- Semantic family: SAP_HEARTWOOD vs COPPER with reset/supersede guards.
- Classification: auto-derived vs manual override vs review state.
- Export readiness: approved artifacts and required lineage.

This complexity is valid for the domain, but it needs very strong tests and docs. The repo has many tests, which is good. I recommend adding a state-transition matrix as an executable test fixture, so every workflow state can be validated from one source.

---

## 10. Testing and Quality Gates

### 10.1 Current quality setup

`package.json` defines:

- `lint`: `eslint`
- `typecheck`: `next typegen && tsc --noEmit --incremental false`
- `test`: `vitest run`
- `test:e2e`: `playwright test`
- `check:design-hardcoding`: `rg`-based style guard
- `handoff:archive`
- `jobs:prediction-import`
- `storage:cleanup`

The test tree contains 50 files, including unit/integration/e2e coverage for auth, crop workflows, prediction imports, exports, API behavior, hardcoding checks, and browser smoke tests.

### 10.2 Gaps in this review

Because dependencies were not included, I could not run the full quality suite. This is not a criticism of the repo by itself because the user intentionally removed `node_modules`; it is a limitation of this review.

### 10.3 Recommended test additions

1. **Concurrency tests:** two parallel saves to same artifact/crop/classification should either both succeed with different versions or one should retry gracefully.
2. **DB constraint tests:** invalid `ReviewDecision`/`ExportItem` rows should fail if constraints are added.
3. **Docs link checker:** fail on broken markdown links.
4. **Route-doc sync check:** compare actual browser/API routes to documented route list.
5. **Handoff ZIP validator tests:** assert `.env`, `.git`, `.next`, `node_modules`, reports, traces, and tsbuildinfo are excluded.
6. **Audit coverage test/matrix:** mutation handlers must have audit or documented domain attribution.
7. **Upload abuse tests:** max size, missing content-length, wrong checksum, wrong dimensions, unsupported type, and repeated failed upload behavior.

---

## 11. Operational Readiness Review

### 11.1 Good operational foundations

- Runtime config is centralized in `src/server/runtime/config.ts`.
- Required env variables fail fast for DB/S3.
- Upload limits are configurable.
- Batch worker settings are configurable.
- Storage cleanup settings are configurable.
- Trial deployment and Caddy/MinIO/Postgres docs exist.
- Backup/restore docs exist.
- Handoff archive tooling exists.

### 11.2 Missing/weak operational areas for production

| Area | Status | Recommendation |
|---|---|---|
| Metrics/observability | Not prominent in inspected code. | Add structured logs/metrics for uploads, errors, worker jobs, cleanup, exports, rejected requests. |
| Admin dashboards | Known gap. | Add dashboards for exports, review, cleanup, prediction import jobs, audit. |
| Background jobs | Trial runner exists. | Move large exports/imports/cleanup to production-grade queue before broader deployment. |
| Rate limits | Login only. | Add per-user/project limits for expensive writes. |
| Handoff hygiene | Tool exists; uploaded ZIP violated it. | Use and validate handoff archives. |
| Secret management | Env-based. | Ensure production uses secret manager or protected deployment env, never ZIP-shared env files. |

---

## 12. Recommended Ticket Backlog

The following tickets would be a practical way to convert this review into implementation work.

### RB-DOC-001 — Update root architecture map after RB-104

**Priority:** P1  
**Scope:** `ARCHITECTURE.md`, possibly `docs/src/app/routes.md` cross-link.  
**Tasks:**

- Remove stale `/edit` current-flow entry.
- Add current crop entry/workbench/editor routes.
- Document assisted correction route separately.
- Clarify that legacy full-image editor product UI is removed.
- Update known gaps wording for crop export/review.

### RB-DOC-002 — Repair docs README links and add markdown link check

**Priority:** P1  
**Scope:** `docs/README.md`, docs CI/test script.  
**Tasks:**

- Fix links to `docs/src/...`.
- Add markdown link checker or simple repo-path link validation script.
- Add it to quality gates.

### RB-DOC-003 — Consolidate ADR/backlog source of truth

**Priority:** P1  
**Scope:** `docs/adr`, `docs/08-adr`, `docs/architecture/decisions`.  
**Tasks:**

- Decide canonical ADR/backlog layout.
- Remove misleading stub or make redirects unmistakable.
- Add contributor instructions for ADR vs backlog.
- Add guard against duplicate backlog files.

### RB-OPS-001 — Enforce handoff ZIP hygiene

**Priority:** P0/P1  
**Scope:** `scripts/create-handoff-archive.mjs`, new validator script, docs.  
**Tasks:**

- Add `scripts/validate-handoff-archive.mjs`.
- Fail if `.env`, `.git`, `.next`, `node_modules`, `test-results`, `playwright-report`, traces, logs, or tsbuildinfo are present.
- Document exact use in handoff checklist.
- Optionally add a generated manifest to every archive.

### RB-DATA-001 — Add safe version allocation helper

**Priority:** P1/P2  
**Scope:** artifact versions, crop versions, classification versions, BBox versions.  
**Tasks:**

- Implement shared bounded retry helper for version creation.
- Catch Prisma unique-constraint errors.
- Add concurrent save tests.
- Replace local `latest + 1` patterns.

### RB-DATA-002 — Add DB check constraints for exact-one-target review decisions

**Priority:** P2  
**Scope:** Prisma migration raw SQL + tests.  
**Tasks:**

- Add `CHECK` constraint for `ReviewDecision` exact-one target.
- Add tests.
- Consider similar constraints for `ExportItem` in a follow-up.

### RB-SEC-001 — Add authenticated write rate limits

**Priority:** P2  
**Scope:** uploads, mask commits, exports, batch import creation/processing, cleanup.  
**Tasks:**

- Define per-user/project quotas.
- Add reusable middleware/helper.
- Return stable API error codes.
- Audit rate-limit hits.

### RB-OPS-002 — Productionize async jobs and observability

**Priority:** P2  
**Scope:** exports, prediction imports, cleanup, worker scripts.  
**Tasks:**

- Define job state model and worker heartbeat/lease contract.
- Add dashboards/CLI status views.
- Add retry/dead-letter semantics.
- Add metrics/logging.

### RB-AUDIT-001 — Add audit coverage matrix

**Priority:** P2  
**Scope:** docs + tests.  
**Tasks:**

- List all mutation routes/domain commands.
- Mark audit mechanism: `AuditLog`, domain row attribution, or system actor.
- Add a test that fails when new mutation route is not in matrix.

### RB-SEC-002 — Define system actor model

**Priority:** P2/P3  
**Scope:** ADR + schema/domain changes if needed.  
**Tasks:**

- Decide whether system actors are special users or a separate actor model.
- Apply to cleanup, batch workers, auto-derivation, future Core handoff.
- Update audit log and docs accordingly.

---

## 13. Suggested Immediate Fix Order

1. **Do not reuse the current uploaded ZIP externally.** Regenerate via `npm run handoff:archive` after dependencies are installed.
2. **Fix `ARCHITECTURE.md` stale `/edit` route.** This is small and prevents future confusion.
3. **Fix `docs/README.md` broken links.** This is also small and high-value for reviewer onboarding.
4. **Consolidate/clarify ADR and backlog locations.** This prevents future Codex/human drift.
5. **Add handoff archive validator.** This closes the process gap that this review exposed.
6. **Add safe version allocation/retry helper.** This is the most likely production data-write issue under real multi-user or multi-tab usage.
7. **Add DB constraints for review/export invariants.** This strengthens long-term data integrity.
8. **Add authenticated write rate limits and async job hardening.** This moves the app from trial robustness toward production robustness.

---

## 14. Final Assessment

SaPen Annotate has a strong architectural baseline. The crop workflow, annotation artifacts, provenance, review/export model, and prediction-assisted secondary mode are all more concrete than the root-level product description alone suggests. The implementation generally follows the stated principles: URL-first workflow, backend-owned state, append-only artifacts, role checks, and evidence-backed docs.

The highest risks are now mostly **operational and governance risks**:

- stale root docs after rapid hotfix/sprint work,
- duplicate documentation source-of-truth folders,
- non-compliant handoff archive hygiene,
- concurrency edge cases in version allocation,
- production-scale rate limits/job processing/observability,
- DB-level protection for a few important audit/export invariants.

Addressing the P1 documentation and handoff issues first would make future Codex reviews and implementation sprints much safer. Addressing version allocation and DB constraints next would reduce real production corruption/flakiness risk.

Overall, I would rate the repo as **trial-ready in architecture direction**, **not yet production-hardened**, and currently in need of a **documentation freshness pass plus operational hardening sprint** before broader external/customer deployment.
