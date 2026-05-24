import crypto from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

import { getRuntimeConfig, type RuntimeRateLimitPolicy } from "@/server/runtime/config";

type HighCostRateLimitDb = PrismaClient | Prisma.TransactionClient;

export const HIGH_COST_ROUTE_FAMILIES = [
  "upload:image",
  "upload:mask",
  "save:editor-artifact",
  "save:crop-artifact",
  "save:slice-metadata",
  "export:create",
  "export:prediction-analysis-create",
  "prediction-import:upload",
  "prediction-import:process-or-retry",
  "operations:cleanup-or-admin",
] as const;

export type HighCostRouteFamily = (typeof HIGH_COST_ROUTE_FAMILIES)[number];

export type HighCostRateLimitResult = {
  allowed: boolean;
  requestCount: number;
  maxRequests: number;
  windowStartedAt: Date;
  retryAfterSeconds: number;
};

type RateLimitRow = {
  requestCount: number | bigint;
  windowStartedAt: Date | string;
};

export class HighCostRateLimitError extends Error {
  public readonly code = "RATE_LIMITED";
  public readonly status = 429;

  constructor(public readonly retryAfterSeconds: number) {
    super("RATE_LIMITED");
  }
}

export function isHighCostRateLimitError(error: unknown): error is HighCostRateLimitError {
  return error instanceof HighCostRateLimitError;
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeScopePart(value: string) {
  return value.trim() || "unknown";
}

function bucketKeyHash(params: {
  family: HighCostRouteFamily;
  userId: string;
  scope: string[];
}) {
  return sha256Hex(
    [
      `family:${params.family}`,
      `user:${normalizeScopePart(params.userId)}`,
      ...params.scope.map((part) => `scope:${normalizeScopePart(part)}`),
    ].join("\0"),
  );
}

export function policyForHighCostFamily(
  family: HighCostRouteFamily,
  config = getRuntimeConfig().highCostLimits,
): RuntimeRateLimitPolicy {
  if (family === "upload:image") return config.upload;
  if (
    family === "upload:mask" ||
    family === "save:editor-artifact" ||
    family === "save:crop-artifact" ||
    family === "save:slice-metadata"
  ) {
    return config.editorSave;
  }
  if (family === "export:create" || family === "export:prediction-analysis-create") {
    return config.exportCreate;
  }
  if (family === "prediction-import:upload" || family === "prediction-import:process-or-retry") {
    return config.predictionImport;
  }
  return config.operations;
}

export function evaluateHighCostRateLimit(params: {
  requestCount: number;
  windowStartedAt: Date;
  policy: RuntimeRateLimitPolicy;
  now?: Date;
}): HighCostRateLimitResult {
  const now = params.now ?? new Date();
  const windowEndsAt = params.windowStartedAt.getTime() + params.policy.windowSeconds * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEndsAt - now.getTime()) / 1000));

  return {
    allowed: params.requestCount <= params.policy.maxRequests,
    requestCount: params.requestCount,
    maxRequests: params.policy.maxRequests,
    windowStartedAt: params.windowStartedAt,
    retryAfterSeconds,
  };
}

export async function enforceHighCostRouteLimit(params: {
  family: HighCostRouteFamily;
  userId: string;
  scope: string[];
  policy?: RuntimeRateLimitPolicy;
  enabled?: boolean;
  now?: Date;
}, db?: HighCostRateLimitDb): Promise<HighCostRateLimitResult | null> {
  const config = getRuntimeConfig().highCostLimits;
  const enabled = params.enabled ?? config.enabled;
  const policy = params.policy ?? policyForHighCostFamily(params.family, config);
  if (!enabled) return null;
  const database = db ?? (await import("@/server/db")).prisma;

  const now = params.now ?? new Date();
  const resetBefore = new Date(now.getTime() - policy.windowSeconds * 1000);
  const pruneBefore = new Date(now.getTime() - policy.windowSeconds * 2000);
  const bucketHash = bucketKeyHash({
    family: params.family,
    userId: params.userId,
    scope: params.scope,
  });

  await database.$executeRaw(Prisma.sql`
    DELETE FROM "HighCostRateLimitBucket"
    WHERE "family" = ${params.family}
      AND "windowStartedAt" < ${pruneBefore}
  `);

  const rows = await database.$queryRaw<RateLimitRow[]>(Prisma.sql`
    INSERT INTO "HighCostRateLimitBucket" (
      "id",
      "family",
      "bucketKeyHash",
      "requestCount",
      "windowStartedAt",
      "lastRequestAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${params.family},
      ${bucketHash},
      1,
      ${now},
      ${now},
      ${now},
      ${now}
    )
    ON CONFLICT ("family", "bucketKeyHash") DO UPDATE SET
      "requestCount" = CASE
        WHEN "HighCostRateLimitBucket"."windowStartedAt" <= ${resetBefore} THEN 1
        ELSE "HighCostRateLimitBucket"."requestCount" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "HighCostRateLimitBucket"."windowStartedAt" <= ${resetBefore} THEN ${now}
        ELSE "HighCostRateLimitBucket"."windowStartedAt"
      END,
      "lastRequestAt" = ${now},
      "updatedAt" = ${now}
    RETURNING "requestCount", "windowStartedAt"
  `);
  const row = rows[0];
  if (!row) throw new Error("HIGH_COST_RATE_LIMIT_BUCKET_MISSING");

  const result = evaluateHighCostRateLimit({
    requestCount: Number(row.requestCount),
    windowStartedAt: new Date(row.windowStartedAt),
    policy,
    now,
  });
  if (!result.allowed) {
    throw new HighCostRateLimitError(result.retryAfterSeconds);
  }
  return result;
}
