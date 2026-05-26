-- RB-064 auth/RBAC/audit hardening.
-- Stores coarse login failure buckets without raw email/IP values.

CREATE TABLE "AuthLoginThrottle" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFailedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthLoginThrottle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthLoginThrottle_scope_identifierHash_key" ON "AuthLoginThrottle"("scope", "identifierHash");
CREATE INDEX "AuthLoginThrottle_lockedUntil_idx" ON "AuthLoginThrottle"("lockedUntil");
