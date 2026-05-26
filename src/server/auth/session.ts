import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/server/db";
import { getRuntimeConfig } from "@/server/runtime/config";
import { SESSION_COOKIE_NAME, SESSION_TTL_DAYS } from "./constants";
import { shouldUpdateLastSeenAt } from "./sessionActivity";

function sha256Base64Url(input: string): string {
  return crypto.createHash("sha256").update(input).digest("base64url");
}

export function sessionTokenHash(token: string): string {
  return sha256Base64Url(token);
}

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url"); // 256-bit
}

export async function getSessionCookie(): Promise<string | undefined> {
  const c = await cookies();
  return c.get(SESSION_COOKIE_NAME)?.value;
}

export async function setSessionCookie(token: string) {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  const c = await cookies();

  c.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function createDbSessionRecord(params: {
  userId: string;
  token: string;
  userAgent?: string;
  ip?: string;
  now?: Date;
}) {
  const { userId, token } = params;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("SESSION_TOKEN_INVALID");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, disabledAt: true },
  });
  if (!user) throw new Error("SESSION_USER_NOT_FOUND");
  if (user.disabledAt) throw new Error("ACCOUNT_DISABLED");

  const tokenHash = sessionTokenHash(token);
  const now = params.now ?? new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  if (typeof tokenHash !== "string" || tokenHash.length === 0) {
    throw new Error("SESSION_TOKENHASH_INVALID");
  }

  return prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      lastSeenAt: now,
      userAgent: params.userAgent,
      ip: params.ip,
    },
  });
}

export async function createDbSession(userId: string, token: string) {
  const h = await headers();
  const userAgent = h.get("user-agent") ?? undefined;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    undefined;

  return createDbSessionRecord({ userId, token, userAgent, ip });
}

export async function getUserFromSessionToken(token: string | undefined | null) {
  if (!token) return null;

  const tokenHash = sessionTokenHash(token);
  const now = new Date();

  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    include: { user: true },
  });

  if (!session) return null;

  if (session.user.disabledAt) {
    await prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: now },
    });
    return null;
  }

  if (
    shouldUpdateLastSeenAt({
      lastSeenAt: session.lastSeenAt,
      now,
      intervalSeconds: getRuntimeConfig().auth.sessionLastSeenUpdateIntervalSeconds,
    })
  ) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
  }

  return session.user;
}

export async function getUserFromSessionCookie() {
  const token = await getSessionCookie();
  return getUserFromSessionToken(token);
}

export async function revokeSessionFromCookie() {
  const token = await getSessionCookie();
  if (!token) return;

  const tokenHash = sessionTokenHash(token);

  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
