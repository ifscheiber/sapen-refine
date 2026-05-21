# Auth Feature

Auth UI currently consists of the `/login` route and local credential login through `/api/auth/login`.

Important files:

- `src/app/(public)/login/page.tsx`
- `src/app/(public)/login/LoginForm.tsx`
- `src/server/auth/session.ts`
- `src/server/auth/rbac.ts`
- `src/server/auth/policies.ts`
- `src/server/auth/loginThrottle.ts`
- `src/server/auth/redirects.ts`

RB-064 hides demo credentials outside development/explicit opt-in, sanitizes login redirects, adds DB-backed throttling, and records login audit events.
