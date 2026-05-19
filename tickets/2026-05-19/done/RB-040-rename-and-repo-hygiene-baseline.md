# RB-040 Rename `sapen-refine` to `sapen-annotate` and establish repository hygiene/documentation baseline

## Status
Proposed

## Priority
P1 — must be done before larger standalone annotation-domain work, because naming, docs, repository boundaries, and Codex onboarding should be stable before the next feature tickets are implemented.

## Recommended product decision

- Product/UI name: **SaPen Annotate**
- Repository name: **`sapen-annotate`**
- Package/app identifier: **`sapen-annotate`**

## Context

The current repository has previously named `sapen-refine`. That name fits the later correction/refinement workflow for model predictions, but the planned standalone app is broader:

- scratch annotation of Heartwood/Sapwood masks and Copper masks,
- accountable user attribution for every annotation action,
- annotation projects for different experimental series,
- image metadata such as T-number, camera, exposure, operator, date, color profile and acquisition settings,
- admin export of images, masks and metadata for training,
- later prediction-assisted annotation and uncertainty-based prioritization.

Therefore the the product/repository has been changed to **sapen-annotate". The first slice should be to clean up the repo before changing the domain model.

## Goal

Create a clean, navigable, Codex-friendly baseline repository for **SaPen Annotate**.

This ticket is about naming, repository hygiene, documentation structure and onboarding. It must not redesign the annotation data model yet.

## Non-goals / out of scope

Do **not** implement the following in this ticket:

- new Prisma domain model for annotation projects, image metadata, annotation tasks or export batches,
- admin export functionality,
- prediction-assisted annotation,
- editor refactor/consolidation,
- mask serialization migration,
- iPad/Pencil-specific UX redesign,
- new authentication provider or user-management UI.

These are follow-up tickets.

---

# Scope

## A. Rename product/repository from `sapen-refine` to `sapen-annotate`

Perform a repository-wide rename while preserving current behavior.

Required changes:

1. Rename repository/folder references from `sapen-refine` to `sapen-annotate` where they refer to the product/app/repo.
2. Update `package.json` package name to `sapen-annotate`.
3. Update README, app metadata, browser title and visible UI labels from “SaPen Refine” / Create Next App defaults to **SaPen Annotate**.
4. Update any local development, Docker, Caddy, deployment, script, service or environment references containing `sapen-refine`.
5. Update product-specific cookie/session names if applicable, for example to `sapen_annotate_session`. If this invalidates existing local sessions, document it as an intentional development-side effect.
6. Ensure no behavior-changing route/API changes are introduced merely because of the rename.
7. Search for remaining `sapen-refine`, `SaPen Refine`, `refine` occurrences and classify them:
   - rename if they refer to the whole app/product/repo,
   - keep only if they intentionally refer to the future “refine/correction mode” or historical migration context,
   - document intentional leftovers.

## B. Repository hygiene baseline

Clean up the repository so it is safe to share, zip and hand over to Codex.

Required changes:

1. Ensure `.gitignore` excludes at least:
   - `.env`, `.env.*`, except `.env.example`,
   - `node_modules/`,
   - `.next/`,
   - build/cache artifacts,
   - local storage/minio data if present,
   - generated logs and temporary files.
2. Add or update `.env.example` with placeholders only. Do not include real secrets.
3. Remove real local `.env` files from the repository if tracked. If they were only present in exported ZIPs, document that they must not be included in future handoff ZIPs.
4. Remove, move or explicitly document stale nested leftovers such as unexpected `src/app/package.json`, `src/app/docker-compose.yml` or similar files if they are not part of the intended app structure.
5. Make the README project-specific and useful. It should at least include:
   - product purpose,
   - local setup,
   - environment variables,
   - Prisma setup/migration commands,
   - dev/build/test/lint commands,
   - storage assumptions,
   - known MVP limitations,
   - links to `AGENTS.md`, `ARCHITECTURE.md` and `docs/`.
6. Ensure all new documentation uses stable terminology: **SaPen Annotate** for the app, “refine mode” only for the later prediction-correction workflow.

## C. Add `AGENTS.md` for Codex onboarding

Create a root-level `AGENTS.md` that gives Codex enough context to work safely in the repository.

Minimum required sections:

1. **Project identity**
   - App name: SaPen Annotate.
   - Purpose: standalone annotation app for training data creation.
   - Relationship to SaPen Core: separate sellable app, not a Core subtree; integration later via explicit handoff/export contracts.

2. **Current product scope**
   - Scratch annotation first.
   - Later correction/refinement of model predictions.
   - Admin export/training interface planned but not yet implemented.

3. **Operating rules for Codex**
   - Keep changes small and ticket-scoped.
   - Do not commit secrets.
   - Do not introduce schema changes unless the ticket explicitly asks for them.
   - Do not delete annotation history unless an explicit retention/migration ticket says so.
   - Preserve auditability and user attribution as architectural priorities.
   - Update docs when changing module behavior.

4. **Repository map**
   - High-level overview of `src/app`, `src/components`, `src/lib`, `prisma`, storage helpers, auth helpers, editor code and tests if present.
   - Mark known legacy/duplicate areas if they remain.

5. **Commands**
   - Install command.
   - Prisma generate/migrate commands.
   - Dev server command.
   - Lint/typecheck/build/test commands available in the repo.

6. **Validation expectations**
   - Run the strongest available validation for the touched scope.
   - If validation cannot run because dependencies are missing, state that explicitly in the final Codex report.

7. **Known architectural risks**
   - Current mask serialization inconsistency.
   - Duplicate editor implementations.
   - Narrow current domain model.
   - Missing admin export.
   - Upload/commit endpoint hardening still required.

## D. Add root `ARCHITECTURE.md`

Create a root-level `ARCHITECTURE.md` that explains the current architecture and clearly marks known gaps.

Minimum required sections:

1. **Overview**
   - What SaPen Annotate does now.
   - What it is intended to become.

2. **System boundaries**
   - Standalone app.
   - Authentication boundary.
   - Database boundary.
   - Object storage boundary.
   - Future SaPen Core / training-module boundaries.

3. **Current technical stack**
   - Next.js app structure.
   - Prisma/PostgreSQL.
   - S3/MinIO-style object storage.
   - Local auth/session model.

4. **Current data model summary**
   - Users/sessions.
   - Projects/memberships.
   - Images.
   - Masks and mask versions.
   - Explain explicitly that this is MVP-level and not yet sufficient for final training-data workflows.

5. **Current flows**
   - Login/session.
   - Project creation/listing.
   - Image upload/commit.
   - Editor open/save/reload mask.

6. **Security and audit assumptions**
   - Current MVP state.
   - Gaps to be addressed later: rate limiting, admin user management, stronger object validation, audit events.

7. **Known architectural gaps / follow-up tickets**
   - Annotation domain model.
   - Metadata model.
   - Admin export.
   - Mask format normalization.
   - Editor consolidation.
   - Upload/commit hardening.
   - iPad/Pencil UX.

8. **Documentation links**
   - Link to `docs/README.md` and relevant module docs.

## E. Add `docs/` folder mirroring the repository structure

Create a documentation folder (already done) that mirrors the relevant repo structure and makes navigation easy for humans and Codex.

The docs folder does not need exhaustive documentation yet, but it must establish the structure and include useful starter pages.

Required baseline structure, adjusted to actual repo structure as needed:

```text
docs/
  README.md
  architecture/
    README.md
    decisions/
      README.md
      ADR-0001-sapen-annotate-naming.md
  app/
    README.md
    routes.md
    api.md
  components/
    README.md
    editor.md
  lib/
    README.md
    auth.md
    storage.md
    masks.md
  prisma/
    README.md
    schema.md
  workflows/
    README.md
    annotation-from-scratch.md
    future-prediction-assisted-annotation.md
  operations/
    README.md
    local-development.md
    environment.md
    handoff-zip-checklist.md
  known-gaps.md
```

If the actual repository contains different directories, mirror the actual directories and explain deviations.

### Documentation rules

Each module documentation page should follow this lightweight pattern:

```md
# <Module / folder name>

## Purpose
What this module/folder is responsible for.

## Important files
Short list of important files and what they do.

## Public interfaces / routes / functions
Only where applicable.

## Invariants and constraints
Rules that must not be broken.

## Known gaps
What is intentionally incomplete or risky.

## Related tickets / docs
Links to follow-up docs or tickets.
```

### `docs/README.md` requirements

The root docs index must provide a navigable overview:

- “Start here” section.
- Link to `ARCHITECTURE.md`.
- Link to `AGENTS.md`.
- Link to major module docs.
- Link to known gaps.
- Link to ADRs.

## F. Add initial ADR for the naming decision

Create `docs/architecture/decisions/ADR-0001-sapen-annotate-naming.md`.

It should document:

- previous name: `sapen-refine`,
- new name: `sapen-annotate`,
- reason: app scope is broader than refinement,
- consequence: “refine” remains available as a future workflow/mode term, not as the product/repo name.

---

# Acceptance criteria

## Rename

- The app/package/repo documentation consistently uses **SaPen Annotate** and `sapen-annotate`.
- No unintended `sapen-refine` references remain.
- Any intentional remaining “refine” wording is documented as referring to a future correction/refinement mode.
- Visible UI metadata/title no longer says Create Next App or SaPen Refine.

## Hygiene

- `.gitignore` prevents local secrets and build artifacts from being committed.
- `.env.example` exists and contains placeholders only.
- No real `.env`/secret files are tracked.
- README is project-specific and no longer generic Next.js starter text.
- Stale nested repo leftovers are removed or explicitly documented.

## Documentation

- Root `AGENTS.md` exists and is useful for Codex.
- Root `ARCHITECTURE.md` exists and documents current architecture plus known gaps.
- `docs/` exists and contains a navigable structure mirroring the repo.
- `docs/README.md` acts as a documentation index.
- At least one ADR exists for the rename decision.
- Module docs are lightweight but meaningful; no empty placeholder-only pages.

## Behavior preservation

Manual smoke path still works after rename:

1. Start app locally.
2. Login with a valid local test user.
3. Create/open a project.
4. Upload an image.
5. Open image in editor.
6. Draw/save a mask.
7. Reload and verify the latest mask still loads.

## Validation

Run the strongest available validation commands, depending on the repo setup:

```bash
npm install
npx prisma generate
npm run lint
npm run build
```

If the repository has typecheck/test commands, run them too:

```bash
npm run typecheck
npm test
```

If commands cannot be run because dependencies/environment are missing, document this explicitly in the implementation report.

---

# Suggested implementation order

1. Inspect current repo structure and package scripts.
2. Rename product/package/UI/docs references.
3. Clean `.gitignore`, `.env.example`, README and stale repo leftovers.
4. Add `AGENTS.md`.
5. Add `ARCHITECTURE.md`.
6. Add `docs/` structure and initial module docs.
7. Add ADR-0001 for naming.
8. Run search for stale naming references.
9. Run validation commands.
10. Commit with a clear message, e.g.:

```bash
git commit -m "rename app to sapen-annotate and add repo docs baseline"
```

---

# Codex prompt

```text
Implement ticket RB-040 in the current standalone annotation repository.

Goal:
Rename the app/repository identity from sapen-refine / “SaPen Refine” to sapen-annotate / “SaPen Annotate” and establish a clean repository hygiene + documentation baseline. This is an infrastructure/docs ticket only. Do not redesign the annotation domain model or add new product features.

Context:
The app is intended to become a standalone annotation tool for creating training data for SaPen models. It must support scratch annotation first and later prediction-assisted correction/refinement. The current name “Refine” is too narrow because the app is broader than correction of model predictions.

Required work:
1. Rename app/product/package references:
   - product/UI name: SaPen Annotate
   - repo/package identifier: sapen-annotate
   - update package metadata, README, app metadata/title, visible labels, local dev/deployment references and any cookie/session names where product-specific.
   - preserve runtime behavior.
   - classify any remaining “refine” references as either stale rename targets or intentional future refine-mode terminology.

2. Repository hygiene:
   - ensure .gitignore excludes local secrets, .env files except .env.example, node_modules, .next, build/cache artifacts, local storage data, logs and temp files.
   - create/update .env.example with placeholders only.
   - ensure no real secrets/local .env files are tracked.
   - remove, move or explicitly document stale nested repo leftovers such as unexpected src/app/package.json or src/app/docker-compose.yml if present and not intentional.
   - replace generic Create Next App README content with SaPen Annotate-specific onboarding.

3. Add root AGENTS.md:
   - explain project identity, scope, relationship to SaPen Core, Codex operating rules, repo map, commands, validation expectations and known risks.
   - include rules: no secrets, keep changes ticket-scoped, no schema changes unless ticketed, preserve auditability and user attribution, update docs for changed behavior.

4. Add root ARCHITECTURE.md:
   - document current architecture, system boundaries, stack, current MVP data model, current flows, security/audit assumptions and known architectural gaps.
   - explicitly state that the current model is not yet sufficient for final training-data workflows.

5. Add docs/ folder mirroring the repository structure:
   - create docs/README.md as navigation index.
   - create lightweight docs for app/routes/api, components/editor, lib/auth/storage/masks, prisma/schema, workflows, operations and known gaps, adjusted to the actual repo structure.
   - add docs/architecture/decisions/ADR-0001-sapen-annotate-naming.md documenting the naming decision.
   - docs should be useful, not empty placeholders.

Out of scope:
- no new Prisma domain model,
- no admin export,
- no prediction-assisted annotation,
- no editor consolidation,
- no mask serialization migration,
- no upload/commit hardening,
- no iPad UX implementation.

Validation:
Run the strongest available validation commands, at least:
- npm install if needed
- npx prisma generate
- npm run lint
- npm run build
Also run typecheck/test commands if present.
If dependencies or env are missing, document exactly what could not be run and why.

Final report:
Provide:
- summary of changes,
- files created/changed,
- stale references found and how handled,
- validation results,
- any remaining risks or follow-up tickets.
```
