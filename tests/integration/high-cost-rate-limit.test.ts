import { afterAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  enforceHighCostRouteLimit,
  HighCostRateLimitError,
} from "@/server/http/highCostRateLimit";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

describe("high-cost rate limit persistence", () => {
  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it("blocks over-threshold requests and resets after the window", async () => {
    const userId = `rate-limit-user-${Date.now()}`;
    const scope = [`project-${Date.now()}`];
    const policy = { maxRequests: 2, windowSeconds: 60 };
    const startedAt = new Date("2026-05-24T10:00:00.000Z");

    await expect(
      enforceHighCostRouteLimit(
        { family: "export:create", userId, scope, policy, now: startedAt },
        prisma,
      ),
    ).resolves.toMatchObject({ allowed: true, requestCount: 1 });
    await expect(
      enforceHighCostRouteLimit(
        { family: "export:create", userId, scope, policy, now: new Date("2026-05-24T10:00:10.000Z") },
        prisma,
      ),
    ).resolves.toMatchObject({ allowed: true, requestCount: 2 });
    await expect(
      enforceHighCostRouteLimit(
        { family: "export:create", userId, scope, policy, now: new Date("2026-05-24T10:00:20.000Z") },
        prisma,
      ),
    ).rejects.toBeInstanceOf(HighCostRateLimitError);

    await expect(
      enforceHighCostRouteLimit(
        { family: "export:create", userId, scope, policy, now: new Date("2026-05-24T10:01:01.000Z") },
        prisma,
      ),
    ).resolves.toMatchObject({ allowed: true, requestCount: 1 });
  });
});
