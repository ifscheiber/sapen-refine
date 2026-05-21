# Server Auth

## Purpose

Server auth ties browser sessions to persisted `Session` rows and enforces project membership for protected workflows.

## Important Files

- `src/server/auth/constants.ts` - `SESSION_COOKIE_NAME` and TTL.
- `src/server/auth/session.ts` - cookie, token, session persistence, and revocation helpers.
- `src/server/auth/sessionActivity.ts` - pure last-seen throttle decision helper.
- `src/server/auth/rbac.ts` - authenticated user and project-role guards.
- `src/server/auth/policies.ts` - central project/global permission policy.
- `src/server/auth/redirects.ts` - safe app-relative login redirect sanitizer.
- `src/server/auth/loginThrottle.ts` - DB-backed hashed login failure buckets.
- `src/server/auth/requestGuards.ts` - same-origin mutation guard helpers used by `src/proxy.ts`.
- `src/app/api/auth/login/route.ts` - login route.
- `src/app/api/auth/logout/route.ts` - logout route.
- `src/app/api/auth/me/route.ts` - current-user route.

## Public Interfaces / Routes / Functions

- Cookie: `sapen_annotate_session`.
- `POST /api/auth/login`.
- `POST /api/auth/logout`.
- `GET /api/auth/me`.
- `POST /api/auth/login` may return `429 AUTH_RATE_LIMITED`.

## Invariants And Constraints

- Session tokens are stored in the browser only as HTTP-only cookies.
- The database stores token hashes, not raw session tokens.
- `lastSeenAt` writes are throttled by `SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS`.
- Login throttling stores hashed email/IP buckets in `AuthLoginThrottle`; raw IP/email values are not stored there.
- Unsafe API mutations from cross-site browser contexts are rejected in `src/proxy.ts`.
- Admin-only behavior must be checked server-side when added.

## Known Gaps

- Local password auth is MVP-level.
- Full admin user-management is not implemented.
- General API write rate limiting beyond the login/cross-site guard is not implemented.

## Related Tickets / Docs

- [README.md](README.md)
- [../../prisma/README.md](../../prisma/README.md)
