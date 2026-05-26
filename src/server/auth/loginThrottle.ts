import crypto from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/server/db";
import { getRuntimeConfig } from "@/server/runtime/config";

type LoginThrottleDb = PrismaClient | Prisma.TransactionClient;

export type LoginThrottleBucket = {
  scope: "email" | "ip";
  identifierHash: string;
};

export type LoginThrottleConfig = {
  maxFailures: number;
  windowSeconds: number;
  lockSeconds: number;
};

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function clientIpFromHeaders(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    null
  );
}

function loginThrottleConfig(): LoginThrottleConfig {
  const config = getRuntimeConfig().auth;
  return {
    maxFailures: config.loginRateLimitMaxFailures,
    windowSeconds: config.loginRateLimitWindowSeconds,
    lockSeconds: config.loginRateLimitLockSeconds,
  };
}

export function buildLoginThrottleBuckets(email: string, headers: Headers): LoginThrottleBucket[] {
  const buckets: LoginThrottleBucket[] = [
    {
      scope: "email",
      identifierHash: sha256Hex(`email:${normalizeEmail(email)}`),
    },
  ];

  const ip = clientIpFromHeaders(headers);
  if (ip) {
    buckets.push({
      scope: "ip",
      identifierHash: sha256Hex(`ip:${ip}`),
    });
  }

  return buckets;
}

export function loginThrottleAuditDetails(email: string, headers: Headers) {
  return {
    buckets: buildLoginThrottleBuckets(email, headers),
  };
}

export function isThrottleLocked(lockedUntil: Date | null | undefined, now = new Date()) {
  return Boolean(lockedUntil && lockedUntil.getTime() > now.getTime());
}

export async function checkLoginAllowed(params: {
  email: string;
  headers: Headers;
  now?: Date;
}, db: LoginThrottleDb = prisma) {
  const now = params.now ?? new Date();
  const buckets = buildLoginThrottleBuckets(params.email, params.headers);
  const rows = await db.authLoginThrottle.findMany({
    where: {
      OR: buckets.map((bucket) => ({
        scope: bucket.scope,
        identifierHash: bucket.identifierHash,
      })),
    },
    select: { scope: true, identifierHash: true, lockedUntil: true },
  });

  const lockedUntil = rows
    .map((row) => row.lockedUntil)
    .filter((date): date is Date => isThrottleLocked(date, now))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    allowed: !lockedUntil,
    lockedUntil,
    buckets,
  };
}

export async function recordFailedLoginAttempt(params: {
  email: string;
  headers: Headers;
  now?: Date;
}, db: LoginThrottleDb = prisma) {
  const now = params.now ?? new Date();
  const config = loginThrottleConfig();
  const buckets = buildLoginThrottleBuckets(params.email, params.headers);
  let lockedUntil: Date | null = null;

  for (const bucket of buckets) {
    const row = await db.authLoginThrottle.findUnique({
      where: {
        scope_identifierHash: {
          scope: bucket.scope,
          identifierHash: bucket.identifierHash,
        },
      },
    });

    const windowExpired =
      !row ||
      now.getTime() - row.windowStartedAt.getTime() >
        config.windowSeconds * 1000;
    const failedCount = windowExpired ? 1 : row.failedCount + 1;
    const nextLockedUntil =
      failedCount >= config.maxFailures
        ? new Date(now.getTime() + config.lockSeconds * 1000)
        : null;

    await db.authLoginThrottle.upsert({
      where: {
        scope_identifierHash: {
          scope: bucket.scope,
          identifierHash: bucket.identifierHash,
        },
      },
      update: {
        failedCount,
        windowStartedAt: windowExpired ? now : row?.windowStartedAt ?? now,
        lastFailedAt: now,
        lockedUntil: nextLockedUntil,
      },
      create: {
        scope: bucket.scope,
        identifierHash: bucket.identifierHash,
        failedCount,
        windowStartedAt: now,
        lastFailedAt: now,
        lockedUntil: nextLockedUntil,
      },
    });

    if (
      nextLockedUntil &&
      (!lockedUntil || nextLockedUntil.getTime() > lockedUntil.getTime())
    ) {
      lockedUntil = nextLockedUntil;
    }
  }

  return { lockedUntil, buckets };
}

export async function clearLoginFailures(params: {
  email: string;
  headers: Headers;
}, db: LoginThrottleDb = prisma) {
  const buckets = buildLoginThrottleBuckets(params.email, params.headers);
  await db.authLoginThrottle.deleteMany({
    where: {
      OR: buckets.map((bucket) => ({
        scope: bucket.scope,
        identifierHash: bucket.identifierHash,
      })),
    },
  });
}
