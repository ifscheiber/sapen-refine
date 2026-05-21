import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { createDbSession, createSessionToken, setSessionCookie } from "@/server/auth/session";
import { sanitizeLoginRedirect } from "@/server/auth/redirects";
import {
  checkLoginAllowed,
  clearLoginFailures,
  loginThrottleAuditDetails,
  recordFailedLoginAttempt,
} from "@/server/auth/loginThrottle";
import { recordAuditEvent } from "@/server/domain/audit";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const redirectTo = sanitizeLoginRedirect(body?.next);

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Missing email or password" }, { status: 400 });
  }

  const throttle = await checkLoginAllowed({ email, headers: req.headers });
  if (!throttle.allowed) {
    await recordAuditEvent({
      action: "LOGIN_LOCKOUT",
      entity: "Auth",
      actorId: null,
      details: {
        reason: "PRE_LOCKED",
        lockedUntil: throttle.lockedUntil?.toISOString() ?? null,
        ...loginThrottleAuditDetails(email, req.headers),
      },
    });
    return NextResponse.json({ ok: false, error: "AUTH_RATE_LIMITED" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    const failure = await recordFailedLoginAttempt({ email, headers: req.headers });
    await recordAuditEvent({
      action: failure.lockedUntil ? "LOGIN_LOCKOUT" : "LOGIN_FAILED",
      entity: "Auth",
      actorId: null,
      details: {
        reason: "INVALID_CREDENTIALS",
        lockedUntil: failure.lockedUntil?.toISOString() ?? null,
        ...loginThrottleAuditDetails(email, req.headers),
      },
    });
    return NextResponse.json(
      { ok: false, error: failure.lockedUntil ? "AUTH_RATE_LIMITED" : "Invalid credentials" },
      { status: failure.lockedUntil ? 429 : 401 },
    );
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const failure = await recordFailedLoginAttempt({ email, headers: req.headers });
    await recordAuditEvent({
      action: failure.lockedUntil ? "LOGIN_LOCKOUT" : "LOGIN_FAILED",
      entity: "Auth",
      actorId: user.id,
      details: {
        reason: "INVALID_CREDENTIALS",
        lockedUntil: failure.lockedUntil?.toISOString() ?? null,
        ...loginThrottleAuditDetails(email, req.headers),
      },
    });
    return NextResponse.json(
      { ok: false, error: failure.lockedUntil ? "AUTH_RATE_LIMITED" : "Invalid credentials" },
      { status: failure.lockedUntil ? 429 : 401 },
    );
  }

  const token = createSessionToken();
  await createDbSession(user.id, token);
  await setSessionCookie(token);
  await clearLoginFailures({ email, headers: req.headers });
  await recordAuditEvent({
    action: "LOGIN_SUCCEEDED",
    entity: "Auth",
    actorId: user.id,
    details: loginThrottleAuditDetails(email, req.headers),
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
    redirectTo,
  });
}
