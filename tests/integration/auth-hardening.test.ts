import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let authThrottle: typeof import("@/server/auth/loginThrottle");

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("auth hardening persistence", () => {
  const previousMaxFailures = process.env.LOGIN_RATE_LIMIT_MAX_FAILURES;
  const previousWindowSeconds = process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS;
  const previousLockSeconds = process.env.LOGIN_RATE_LIMIT_LOCK_SECONDS;

  beforeAll(async () => {
    authThrottle = await import("@/server/auth/loginThrottle");
    process.env.LOGIN_RATE_LIMIT_MAX_FAILURES = "2";
    process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS = "60";
    process.env.LOGIN_RATE_LIMIT_LOCK_SECONDS = "60";
  });

  afterAll(async () => {
    restoreEnv("LOGIN_RATE_LIMIT_MAX_FAILURES", previousMaxFailures);
    restoreEnv("LOGIN_RATE_LIMIT_WINDOW_SECONDS", previousWindowSeconds);
    restoreEnv("LOGIN_RATE_LIMIT_LOCK_SECONDS", previousLockSeconds);
    await prisma.$disconnect();
    await pool.end();
  });

  it("locks and clears hashed login throttle buckets", async () => {
    const email = `auth-hardening-${Date.now()}@test.local`;
    const headers = new Headers({ "x-forwarded-for": "203.0.113.10" });

    await authThrottle.clearLoginFailures({ email, headers }, prisma);
    await expect(
      authThrottle.checkLoginAllowed({ email, headers }, prisma),
    ).resolves.toMatchObject({ allowed: true });

    const first = await authThrottle.recordFailedLoginAttempt({ email, headers }, prisma);
    expect(first.lockedUntil).toBeNull();

    const second = await authThrottle.recordFailedLoginAttempt({ email, headers }, prisma);
    expect(second.lockedUntil).toBeInstanceOf(Date);

    await expect(
      authThrottle.checkLoginAllowed({ email, headers }, prisma),
    ).resolves.toMatchObject({ allowed: false });

    await authThrottle.clearLoginFailures({ email, headers }, prisma);
    await expect(
      authThrottle.checkLoginAllowed({ email, headers }, prisma),
    ).resolves.toMatchObject({ allowed: true });
  });
});
