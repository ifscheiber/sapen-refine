# src/server

## Purpose

`src/server` owns server-only infrastructure: database access, authentication/session helpers, RBAC, and storage helpers.

## Important Files

- `src/server/db.ts` - Prisma client and PostgreSQL pool singleton.
- `src/server/auth/constants.ts` - session cookie constants.
- `src/server/auth/session.ts` - session token creation, cookie handling, DB session lookup, and revocation.
- `src/server/auth/rbac.ts` - `requireUser` and `requireProjectRole`.
- `src/server/storage.ts` - app-level storage wrapper for presigned URLs.
- `src/server/storage/s3.ts` - AWS SDK S3/MinIO client setup and presign helpers.

## Public Interfaces / Routes / Functions

- `requireUser()` redirects unauthenticated requests to `/login`.
- `requireProjectRole(projectId, allowed)` enforces project membership roles.
- `getPresignedGetUrl(key)` and `getPresignedPutUrl(key, contentType)` wrap S3 presigned URLs.

## Invariants And Constraints

- Server modules must not import client components.
- Every production write should be attributable to a user or explicit system actor.
- Session cookies use `sapen_annotate_session`; older local cookies are intentionally ignored.

## Known Gaps

- Audit logging is incomplete.
- There is no rate limiting for login or API writes.
- Storage helpers do not yet verify object checksums or dimensions.

## Related Tickets / Docs

- [auth.md](auth.md)
- [storage.md](storage.md)
- [../../operations/environment.md](../../operations/environment.md)
