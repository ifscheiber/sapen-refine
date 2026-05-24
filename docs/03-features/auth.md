# Auth Feature

Auth UI consists of the `/login` route and local credential login through `/api/auth/login`.

Important files:

- `src/app/(public)/login/page.tsx`
- `src/app/(public)/login/LoginForm.tsx`
- `src/server/auth/session.ts`
- `src/server/auth/rbac.ts`
- `src/server/auth/policies.ts`
- `src/server/auth/loginThrottle.ts`
- `src/server/auth/redirects.ts`

DESIGN-001 restyles `/login` as a dark SaPen Annotate split-card shell aligned with the SaPen Core topbar and enterprise token direction. The page keeps the existing local credential submit flow: `LoginForm.tsx` still posts `{ email, password, next }` to `POST /api/auth/login`, displays returned auth errors, uses the API-provided `redirectTo`, and refreshes the router after successful login.

The public login screen intentionally does not render demo credentials, public credential hints, unauthenticated help/settings controls, request-access actions, social login, or CDN-loaded fonts/icons. No password reset route exists in this repository, so the `Forgot password?` control displays the safe inline message `Password reset is not available yet.` instead of linking to a broken route.

RB-064 sanitizes login redirects, adds DB-backed throttling, and records login audit events.
