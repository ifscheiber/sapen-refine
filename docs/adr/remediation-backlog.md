# Remediation Backlog

Deferred work discovered during repository hygiene should be recorded here instead of expanding active ticket scope.

## RB-040-A - Baseline Validation Is Not Green

Context: Baseline `npm run lint` failed before RB-040 changes. Baseline `npm run build` succeeded at compilation when network font access was available, then failed TypeScript in the pre-RB-043 prototype AppShell.

Impact: Future changes cannot rely on lint/build as green regression gates until existing errors are fixed.

Resolution: Fixed by RB-041. Root validation now includes `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test`.

Affected modules: deleted pre-RB-043 prototype shell/editor files, `src/components/ui/sidebar.tsx`, `src/mask/renderOverlay.ts`.

Owner: Codex.

Priority: Resolved.

## RB-040-B - MVP Mask Terminology Still Uses Refinement-Oriented Names

Context: `prisma/schema.prisma` defines `MaskKind.PREDICTION` and `MaskKind.REFINED`.

Impact: The schema language does not yet reflect standalone scratch annotation, label schemas, review states, or export-ready ground truth.

Proposed next step: Add a schema/domain ticket for annotation mask kinds, label-schema versions, review state, and migration compatibility.

Affected modules: `prisma/schema.prisma`, `src/app/api/images/[imageId]/mask/*`, `src/mask/*`, docs under `docs/prisma` and `docs/src/mask`.

Owner: Unassigned.

Priority: P1.

## RB-040-C - Upload And Commit Endpoint Hardening

Context: Current upload commit routes record object keys and basic metadata but do not fully verify object existence, image dimensions, checksums, or content type.

Impact: Training-data reproducibility and raw-image immutability are not strong enough for production.

Proposed next step: Add validation around storage metadata, content length, checksum, image dimensions, and commit idempotency.

Affected modules: `src/app/api/projects/[projectId]/images/*`, `src/app/api/images/[imageId]/mask/*`, `src/server/storage/*`, `prisma/schema.prisma`.

Owner: Unassigned.

Priority: P1.

## RB-040-D - Admin Export And Manifest Workflow Missing

Context: SaPen Annotate is intended to export reviewed datasets, but no export batch or manifest workflow exists yet.

Impact: The app cannot yet produce reproducible training datasets.

Proposed next step: Add an export-domain ticket covering DB model, manifest format, API routes, authorization, and tests.

Affected modules: `prisma/schema.prisma`, `src/app/api`, `src/server`, future export docs.

Owner: Unassigned.

Priority: P1.

## RB-040-E - Editor Consolidation And iPad/Pencil UX

Context: The current editor is MVP-oriented and not yet designed for reliable iPad/Pencil annotation across screen sizes.

Impact: Annotation ergonomics and data quality may suffer on tablet devices.

Proposed next step: Add a focused editor UX ticket after domain model cleanup, covering responsive layout, touch/pointer interactions, canvas scaling, and undo/save behavior.

Affected modules: `src/features/editor/EditorClient.tsx`, `src/features/editor/EditImagePage.tsx`, `src/mask/*`, `src/design/editorCanvas.ts`.

Owner: Unassigned.

Priority: P2.

## RB-040-F - Dependency Audit Findings

Context: `npm install --package-lock-only` reported 26 audit findings: 13 moderate, 12 high, and 1 critical.

Impact: Dependency risk is not understood or remediated, and automated fixes may introduce breaking changes if handled inside an unrelated ticket.

Resolution: RB-042 ran `npm audit`, applied non-forced fixes, updated Next.js to `16.2.6`, and added a PostCSS override. The audit is reduced to 3 moderate Prisma CLI transitive findings.

Affected modules: `package.json`, `package-lock.json`, dependency tree.

Owner: Codex.

Priority: Resolved with follow-up below.

## RB-042-A - Remaining Prisma CLI Audit Findings

Context: After RB-042, `npm audit --json` reports 3 moderate findings: direct `prisma`, transitive `@prisma/dev`, and transitive `@hono/node-server`.

Impact: These affect the Prisma CLI/dev dependency chain. The app runtime dependency `@prisma/client` is not the reported vulnerable direct package.

Proposed next step: Re-check Prisma 7.x releases in a dedicated dependency ticket. Do not apply npm's current `--force` recommendation without review because it would install `prisma@6.19.3` and npm marks that as semver-major.

Affected modules: `package.json`, `package-lock.json`, Prisma CLI dependency chain.

Owner: Unassigned.

Priority: P2.

## RB-041-A - Prototype Editor Lint Warnings

Context: RB-041 restored green lint/build/typecheck/test gates. RB-043 removed the duplicate shell/editor prototype components, but ESLint still reports non-blocking hook dependency warnings in the active editor client.

Impact: The warnings do not fail validation, but they obscure future lint output and point at code that should be simplified during architecture/UI cleanup.

Proposed next step: RB-045 is addressing the remaining hook dependency warnings as part of the editor/iPad readiness baseline.

Affected modules: `src/features/editor/EditorClient.tsx`.

Owner: Codex.

Priority: In progress.

## RB-041-B - Next Middleware Convention Warning

Context: `npm run build` passes but reports that the `middleware` file convention is deprecated in favor of `proxy`.

Impact: This is not a current failure, but it should be cleaned up before larger routing work.

Proposed next step: Rename or adapt `src/middleware.ts` during the app-router architecture baseline if the current Next.js version expects `proxy.ts`.

Affected modules: `src/middleware.ts`, routing docs.

Owner: Unassigned.

Priority: P2.
