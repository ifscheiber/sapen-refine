# AGENTS.md – SaPen Annotate

Purpose  
This file is the entry point for automated agents (Codex) and human contributors working in the SaPen Annotate repository.
It defines product boundaries, scope discipline, documentation rules, and quality expectations.

This is NOT an encyclopedia.  
High-level architecture map lives in `ARCHITECTURE.md`.  
Detailed, evidence-backed implementation documentation lives in `docs/`.  
If these conflict, `docs/` is the source of truth and must be updated.

---

## 1. Product Scope

SaPen Annotate is a standalone annotation application for creating high-quality, attributable, exportable ground-truth data for SaPen model training.

Primary purpose:
- annotate heartwood/sapwood masks,
- annotate copper masks,
- capture slice/type/classification labels,
- capture image and acquisition metadata,
- maintain attribution and version history,
- export reviewed datasets for model training.

Future extensions:
- assisted annotation from model pre-predictions,
- uncertainty/ranking-based correction queues,
- explicit Core-to-Annotate handoff workflows.

Standalone Annotation Mode is the primary product mode. Core correction and pre-prediction workflows are future/secondary modes and must not distort the ground-truth data model.

---

## 2. Core Principles

1) URL-first architecture  
- All user workflows must be reachable via proper Next App Router routes.
- Deep links and browser navigation are first-class.
- Do not hide workflow state inside client-only state machines.

2) Backend as source of truth  
- Annotation state, project membership, task status, image metadata, mask versions, reviews, and exports live in the database via APIs.
- UI must not invent domain state that bypasses backend invariants.

3) Ground-truth integrity  
- Raw images are immutable after commit.
- Mask versions are append-only training artifacts.
- Do not overwrite approved or historical masks.
- Any generated export must be reproducible from stored image, mask, metadata, label-schema, and manifest state.

4) Attribution by design  
- Every annotation, mask commit, review, approval, export, and administrative action must be attributable to an authenticated user or explicitly identified system actor.
- Anonymous production writes are not allowed.

5) Evidence-backed documentation  
- When documenting architecture facts, reference real file paths.
- Avoid speculative documentation.
- If a documented behavior does not exist yet, mark it as planned/future.

6) Reuse before rebuild  
- Before creating new routes, layouts, editor tools, APIs, or storage helpers, inspect existing equivalents.
- Extend existing structures where reasonable instead of duplicating patterns.
- Divergence from established structure requires an ADR note.

---

## 3. Scope Discipline

Agents must operate with strong scope awareness.

### DO
- Keep changes focused on the explicitly requested task.
- Start every implementation task with a baseline check before editing: inspect `git status`, run the relevant existing tests/typechecks where practical, and document whether the baseline is green or already failing.
- If additional improvements are discovered, create a backlog entry instead of expanding scope.
- Before adding new components or APIs, search for existing equivalents.
- Extend existing structures where reasonable.
- Keep PRs logically isolated and reviewable.
- When a coherent task slice or meaningful section is completed and in a committable state, create a focused git commit immediately before continuing to the next slice.
- Commit messages must be detailed enough to explain the completed slice, affected area, and reason for the change; avoid vague messages such as `update`, `fix`, or `changes`.
- Preserve user-facing routes unless the task explicitly requires route changes.
- Update docs for every architectural, domain, API, storage, export, or workflow change.

### DO NOT
- Mix unrelated architectural changes in one implementation.
- Refactor unrelated modules “while you are there.”
- Introduce new product modes implicitly.
- Treat SaPen Annotate projects as SaPen Core experiments unless an ADR explicitly defines the integration.
- Add model pre-prediction or Core-handoff logic while working on pure scratch annotation unless explicitly requested.
- Delete annotation history to “clean up” data.
- Push to remote repositories automatically.
- Skip the baseline check unless the task is explicitly docs-only and no validation command exists.
- Leave multiple completed, unrelated slices uncommitted in the worktree.

If something important is missing:
→ Add a structured entry in  
`docs/adr/remediation-backlog.md`

---

## 4. Architectural Boundaries

### Application

`src/app`  
- Owns route-addressable workflows and API routes.
- Pages and route handlers must stay thin where possible.
- Business/domain decisions belong in server/domain modules, not deeply embedded in UI components.

`src/features`
- Owns feature-specific workflow composition and UI for projects, images, editor, auth-adjacent screens, and future domain areas.
- Server components in this tree may call server-only helpers; client components must use APIs instead of bypassing backend invariants.

`src/server`  
- Owns server-only infrastructure: database access, auth/session helpers, RBAC, storage, and server-side domain services.
- Must not import client components.

`src/mask`  
- Owns mask serialization, label handling, patching, buffer operations, and mask rendering helpers.
- Any change to mask format requires migration/backward-compatibility consideration and documentation.

`src/components`  
- Owns reusable UI components, including `src/components/ui` primitives and `src/components/shell` workspace layout components.
- Domain-heavy editor state should be factored into dedicated editor/domain modules if it grows.

`src/design`
- Owns CSS tokens, theme layering, and centrally approved canvas/design constants.
- Production components should consume semantic token classes rather than one-off raw color values.

`src/lib`  
- Owns client-side API wrappers and shared client helpers.
- Must not duplicate backend validation logic as the only source of truth.

`prisma` / database schema  
- Owns persisted domain model.
- Schema changes must be accompanied by docs and tests.

### Product boundary

SaPen Annotate owns:
- annotation projects,
- raw image assets,
- acquisition metadata,
- semantic masks,
- instance/support masks,
- slice labels/classes,
- annotation tasks,
- review/approval state,
- dataset exports and manifests.

SaPen Annotate does not own:
- SaPen Core experiment readiness,
- Core analysis results,
- Core treatment/wood-sample truth,
- production reporting semantics.

Core integration must use explicit contracts/handoffs and provenance.

---

## 5. Domain Invariants

- Every write action must be authenticated and attributable.
- Admin-only actions must be guarded server-side, not only hidden in UI.
- Raw image files must not be overwritten after commit.
- Image dimensions, storage key, content type, checksum/size, and metadata must be validated server-side where possible.
- Mask dimensions must match the target image or explicitly documented coordinate space.
- Mask labels must use a versioned label schema.
- Semantic masks and instance/support masks must remain conceptually separate.
- Copper annotation does not necessarily cover the full wood slice; full slice support for Cu samples may require a separate instance/support mask.
- Sapwood/heartwood annotations may be convertible to binary slice support only when the mask covers the full slice.
- Approved ground-truth mask versions must be append-only and exportable.
- Review/approval state must not be inferred solely from the latest mask version.
- Dataset exports must include a manifest with project, image, metadata, label schema, mask versions, attribution/provenance, and checksums.
- Annotation Projects are not SaPen Core Projects unless a later ADR defines a shared workspace model.
- Predicted masks must never overwrite human ground truth; predictions are separate provenance-bearing inputs for assisted correction.

If invariants change:
→ Update affected docs under `docs/`  
→ Add or update an ADR in `docs/adr/`

---

## 6. Documentation Governance

System of record:
- `docs/` is the authoritative, evidence-backed documentation tree.

High-level map:
- `ARCHITECTURE.md` is a short architecture map, not a deep implementation document.

Required docs baseline:
- `docs/README.md` – navigation index
- `docs/src/app/README.md` – routes and API map
- `docs/src/server/README.md` – server/auth/storage/data access map
- `docs/src/mask/README.md` – mask formats, label schema, coordinate spaces
- `docs/src/components/README.md` – major UI/editor components
- `docs/src/lib/README.md` – client API wrappers
- `docs/prisma/README.md` – persisted domain model
- `docs/testing/README.md` – test strategy and quality gates
- `docs/adr/README.md` – ADR index
- `docs/adr/remediation-backlog.md` – deferred architectural debt

The `docs/` tree should mirror the repository structure where practical. Add topic docs near the mirrored path they describe.

When making architectural or boundary changes:
- Update affected docs.
- Update evidence file paths if moved.
- Update ADR notes if design decisions changed.
- Add a backlog entry if something is deferred.

AGENTS.md must remain short and stable.

---

## 7. Backlog Protocol

When encountering missing features, inconsistencies, or architectural debt:

1. Do NOT silently expand scope.
2. Add a structured backlog entry in:
   `docs/adr/remediation-backlog.md`
3. Continue with the requested task.

Backlog entries must include:
- Context
- Impact
- Proposed next step
- Affected modules
- Owner
- Priority

---

## 8. Baseline-First and Commit Discipline

Agents must use a baseline-first workflow. The first step of any non-trivial implementation task is to establish the current repository state before making changes.

Baseline procedure:
- Run `git status --short` and identify pre-existing untracked or modified files.
- Run the most relevant existing validation commands before editing where practical, for example typecheck, lint, route/API tests, mask tests, or docs-link checks.
- If the baseline already fails, record the failing command and failure summary in the implementation notes, then avoid mixing baseline failures with new regressions.
- Do not “fix” unrelated baseline failures unless the task explicitly asks for it; add a backlog entry instead.

Test-first expectation:
- For behavior changes, add or update the failing/covering test before or together with the production change.
- For bug fixes, reproduce the bug with a focused test first where practical.
- For docs-only or rename-only slices, the baseline still matters: run suitable lightweight checks such as docs-link checks, typecheck, or grep-based verification.

Commit discipline:
- Work in small coherent slices.
- At the end of each completed slice or meaningful section, run the relevant validation for that slice.
- If the slice is green and logically complete, create a focused git commit before starting the next slice.
- Do not accumulate several unrelated finished slices into one large commit.
- Commit messages should state the intent and affected area, for example `docs: add annotate architecture baseline` or `refactor: rename app package to annotate`.
- If a slice cannot be committed because validation is blocked by known pre-existing failures, document that explicitly in the handoff notes.

---

## 9. Testing & Quality Gates

Primary goal: protect annotation-data integrity and export reproducibility.

Preferred test order:

1) Route-handler/API integration tests
- Call route handlers directly where practical.
- Assert HTTP status, payload shape, authorization, and persisted DB effects.
- For JSON API responses, assert the canonical API contract header if the repo defines one.

2) DB/domain integration tests
- Verify ownership, attribution, versioning, review state, label schema, and export manifest invariants.

3) Unit tests
- Mask serialization/deserialization.
- Label schema validation.
- Coordinate-space conversions.
- Patch application.
- Export manifest construction.

4) UI/E2E tests
- Only for small golden paths unless explicitly requested.
- Prioritize: login, create project, upload image, annotate mask, save version, review/approve, export.

Test conventions:
- No network calls to real services.
- Mock external object storage where appropriate.
- Use deterministic fixtures.
- Clean up DB rows created by tests.
- Keep tests organized by workflow/module.

Documentation rules:
- Every PR that adds or changes tests must update `docs/testing/README.md` or a test index if present.
- Test-only PRs must not change production code.

---

## 10. Task-Type Documentation Rules

Docs-only tasks:
- Update `docs/**` and align `ARCHITECTURE.md`/`AGENTS.md` if needed.

Code/feature tasks:
- Update relevant mirrored docs and ADR/backlog as needed.
- Update `ARCHITECTURE.md` only for map-level changes: topology, product modes, runtime model, boundary changes, truth-source changes.

Schema/domain tasks:
- Update `docs/prisma/README.md`.
- Update domain invariants.
- Add or update ADR if the semantic model changes.

Mask/editor tasks:
- Update `docs/src/mask/README.md` and relevant editor/component docs.
- Include tests for format compatibility and coordinate-space assumptions.

Export/training-data tasks:
- Update export manifest documentation.
- Include tests proving reproducibility and manifest completeness.

---

## 11. Quality Expectations

Changes must:
- Preserve route consistency.
- Preserve annotation-data integrity.
- Preserve attribution and auditability.
- Preserve immutable raw image and mask version history.
- Keep product modes clearly separated.
- Avoid duplicate editor flows.
- Keep docs navigable and evidence-backed.

If uncertain:
→ Prefer consistency, explicit provenance, and data integrity over convenience.

---

## 12. Current Repository Baseline

Project identity:
- App/product name: SaPen Annotate.
- Package/repo identifier: `sapen-annotate`.
- Relationship to SaPen Core: separate standalone app; future Core integration must use explicit handoff/export contracts.

Current repository map:
- `src/app` – App Router pages and API routes.
- `src/server/auth` – local session cookie, session persistence, and RBAC helpers.
- `src/server/storage` – S3/MinIO presigned URL helpers.
- `src/mask` – current mask labels, buffers, serialization, patching, and overlay helpers.
- `src/components` – current reusable UI and editor components.
- `src/lib` – browser-side API wrappers.
- `prisma` – Prisma schema, migrations, and seed scripts.
- `docs` – authoritative implementation documentation.

Commands:
- Install: `npm install`
- Prisma generate: `npx prisma generate`
- Local services: `npm run db:up` / `npm run db:down`
- Migrate/seed: `npm run prisma:migrate` / `npm run seed`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Build/typecheck: `npm run build`

Validation expectations:
- Run the strongest available command for the touched scope.
- If dependencies, Prisma cache access, network font fetches, Docker, or environment variables block validation, record the exact command and failure.
- The current green root baseline is `npm run db:rebuild`, `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, `npm run test:e2e`, and `npm run check:design-hardcoding` when local Docker services are available.

Known architectural risks:
- Current mask terminology and serialization are MVP-level and need normalization.
- Editor implementation is large and should be decomposed incrementally before heavier production annotation workflows.
- Project overview operations are becoming dense and should be split into route-addressable operations areas before customer/iPad scale-up.
- RBAC, audit coverage, login hardening, background workers, retention cleanup, and advanced export/history workflows remain incomplete.
- Trial-sized training export, prediction-analysis export, prediction import, correction tasks, and batch prediction import workflows exist but are not production-scale operations yet.

---

End of file.
