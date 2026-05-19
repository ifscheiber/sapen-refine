# Server Auth

## Purpose

Server auth ties browser sessions to persisted `Session` rows and enforces project membership for protected workflows.

## Important Files

- `src/server/auth/constants.ts` - `SESSION_COOKIE_NAME` and TTL.
- `src/server/auth/session.ts` - cookie, token, session persistence, and revocation helpers.
- `src/server/auth/rbac.ts` - authenticated user and project-role guards.
- `src/app/api/auth/login/route.ts` - login route.
- `src/app/api/auth/logout/route.ts` - logout route.
- `src/app/api/auth/me/route.ts` - current-user route.

## Public Interfaces / Routes / Functions

- Cookie: `sapen_annotate_session`.
- `POST /api/auth/login`.
- `POST /api/auth/logout`.
- `GET /api/auth/me`.

## Invariants And Constraints

- Session tokens are stored in the browser only as HTTP-only cookies.
- The database stores token hashes, not raw session tokens.
- Admin-only behavior must be checked server-side when added.

## Known Gaps

- Local password auth is MVP-level.
- Rate limiting, account lockout, and admin user-management are not implemented.

## Related Tickets / Docs

- [README.md](README.md)
- [../../prisma/README.md](../../prisma/README.md)
