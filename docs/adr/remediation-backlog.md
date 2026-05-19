# Remediation Backlog

Deferred work discovered during repository hygiene should be recorded here instead of expanding active ticket scope.

## RB-040-A - Baseline Validation Is Not Green

Context: Baseline `npm run lint` fails before RB-040 changes. Baseline `npm run build` succeeds at compilation when network font access is available, then fails TypeScript in `src/app/app/AppShell.tsx`.

Impact: Future changes cannot rely on lint/build as green regression gates until existing errors are fixed.

Proposed next step: Create a focused validation debt ticket that fixes existing ESLint and TypeScript failures without changing product behavior.

Affected modules: `src/app/app/AppShell.tsx`, `src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx`, `src/app/app/projects/[projectId]/images/ui.tsx`, `src/components/AnnotationCanvas.tsx`, `src/components/ui/sidebar.tsx`, `src/mask/renderOverlay.ts`.

Owner: Unassigned.

Priority: P1.

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

Affected modules: `src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx`, `src/components/AnnotationCanvas.tsx`, `src/components/EditorToolsBar.tsx`, `src/components/TabSidebar.tsx`.

Owner: Unassigned.

Priority: P2.

## RB-040-F - Dependency Audit Findings

Context: `npm install --package-lock-only` reported 26 audit findings: 13 moderate, 12 high, and 1 critical.

Impact: Dependency risk is not understood or remediated, and automated fixes may introduce breaking changes if handled inside an unrelated ticket.

Proposed next step: Run `npm audit` in a dedicated dependency-maintenance ticket, classify direct versus transitive findings, and update packages with validation.

Affected modules: `package.json`, `package-lock.json`, dependency tree.

Owner: Unassigned.

Priority: P1.
