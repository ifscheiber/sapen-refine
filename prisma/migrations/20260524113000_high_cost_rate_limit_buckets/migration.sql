-- RB-111 high-cost authenticated write limiter buckets.
-- Stores hashed logical route/user/scope buckets only; raw user or project ids are
-- not persisted in this operational table.

CREATE TABLE "HighCostRateLimitBucket" (
    "id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "bucketKeyHash" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRequestAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HighCostRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HighCostRateLimitBucket_family_bucketKeyHash_key"
  ON "HighCostRateLimitBucket"("family", "bucketKeyHash");

CREATE INDEX "HighCostRateLimitBucket_windowStartedAt_idx"
  ON "HighCostRateLimitBucket"("windowStartedAt");
