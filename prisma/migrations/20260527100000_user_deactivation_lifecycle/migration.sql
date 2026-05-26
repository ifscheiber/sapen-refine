-- Add explicit user deactivation state so access can be revoked without deleting
-- attribution-bearing user rows.
ALTER TABLE "User"
  ADD COLUMN "disabledAt" TIMESTAMP(3),
  ADD COLUMN "disabledById" TEXT,
  ADD COLUMN "disabledReason" TEXT;

CREATE INDEX "User_disabledAt_idx" ON "User"("disabledAt");
CREATE INDEX "User_disabledById_idx" ON "User"("disabledById");

ALTER TABLE "User"
  ADD CONSTRAINT "User_disabledById_fkey"
  FOREIGN KEY ("disabledById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
