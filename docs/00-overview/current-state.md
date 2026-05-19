# Current State

## Purpose

This page records the repository state after RB-049 annotation-domain schema implementation.

## Important Files

- `package.json` - root scripts for Prisma generation, lint, typecheck, build, Vitest, Playwright E2E, and design-hardcoding checks.
- `prisma/schema.prisma` - current annotation-domain persisted model.
- `src/app/(public)/login/page.tsx` and `src/app/(public)/login/LoginForm.tsx` - public login route.
- `src/app/(workspace)/app/**` - protected App Router workspace URLs.
- `src/app/api/**` - current auth, project, image, mask, health, and readiness route handlers.
- `src/features/projects`, `src/features/images`, and `src/features/editor` - feature-owned workflow composition.
- `src/server/auth`, `src/server/runtime`, `src/server/storage`, and `src/server/uploads` - server-only auth, config, storage, and upload validation helpers.
- `src/mask` - current label constants, mask buffers, serialization, patching, and overlay rendering.
- `src/components/shell` and `src/design` - reusable workspace shell, UI primitives, design tokens, and editor canvas constants.
- `tests/e2e/desktop-browser-smoke.spec.ts` and `tests/e2e/ipad-viewport-prep.spec.ts` - current browser smoke coverage.

## Current Baseline

The RB-048 pre-edit baseline is green:

- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run test:e2e`
- `npm run check:design-hardcoding`

There is no `check:docs-links` script in `package.json` yet.

## Current Application Model

- Local login uses `src/app/api/auth/login/route.ts`, `src/server/auth/session.ts`, and the `User`/`Session` tables.
- Project membership is the current access boundary through `AnnotationProject` and `AnnotationProjectMember`; `src/server/auth/rbac.ts` enforces project roles for protected project/image workflows.
- Image upload uses app-mediated trial paths in `src/app/api/projects/[projectId]/images/upload/route.ts`; legacy presign/commit routes still exist for compatibility.
- Browser image reads use app-mediated routes such as `src/app/api/images/[imageId]/asset/route.ts` and `src/app/api/images/[imageId]/view/route.ts`.
- The editor route is `/app/projects/[projectId]/images/[imageId]/edit`, composed by `src/features/editor/EditImagePage.tsx` and `src/features/editor/EditorClient.tsx`.
- Mask save uses app-mediated upload through `src/app/api/images/[imageId]/mask/upload/route.ts`; legacy presign/commit routes still exist.
- Latest mask reload uses `src/app/api/images/[imageId]/mask/latest/route.ts` and app-mediated version assets.

## Current Data Model

- `AnnotationProject` is the standalone collaboration container and can reference an active label schema version.
- `ImageAsset` stores a raw object key, basic file metadata, optional checksum/dimensions, validation status, uploader, and metadata relations.
- `AnnotationArtifact` groups semantic/support/instance/prediction/derived artifacts by image, kind, and scope key.
- `AnnotationArtifactVersion` is append-only per artifact and stores artifact key, size, dimensions, format, label schema version, review state, provenance, creator, and timestamp.
- `AuditLog` exists but is not yet a complete attribution/audit trail for project, image, mask, review, approval, or export actions.

## Invariants And Constraints

- URL-first workspace routes must remain stable while domain implementation evolves.
- Raw image objects should be treated as immutable after commit.
- Mask saves should append versions instead of overwriting previous versions.
- Writes must be tied to an authenticated user or an explicit future system actor.
- Development data may be destroyed during schema work; RB-049 replaces the baseline migration and uses `npm run db:rebuild`.

## Known Gaps

- The current schema models label schemas, annotation tasks/sessions, acquisition/sample metadata structures, review decisions, slice instances/classifications, export records, and prediction provenance placeholders. RB-050 adds the first project/image metadata workflow; remaining user-facing workflows start with RB-051.
- Copper masks are semantic material annotations; support/instance artifact kinds exist in the schema, but the separate user workflow remains RB-051.
- Upload hardening still needs checksum, object metadata, dimensions, and stronger audit coverage.
- Real iPad Safari validation remains deferred until deployment/device access is available.

## Related Tickets / Docs

- [baseline-checks.md](baseline-checks.md)
- [../06-data/prisma.md](../06-data/prisma.md)
- [../06-data/mask-format.md](../06-data/mask-format.md)
- [../testing/README.md](../testing/README.md)
