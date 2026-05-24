UPDATE "ExportBatch"
SET
  "status" = 'COMPLETED',
  "completedAt" = COALESCE("completedAt", "exportedAt"),
  "failedAt" = NULL,
  "errorCode" = NULL,
  "errorMessage" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'CREATED'
  AND "manifestStorageKey" IS NOT NULL
  AND "packageStorageKey" IS NOT NULL;
