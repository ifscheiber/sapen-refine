import { beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";

let cleanup: typeof import("@/server/domain/storageCleanup");

describe("storage cleanup helpers", () => {
  beforeAll(async () => {
    loadEnv({ path: ".env.local" });
    cleanup = await import("@/server/domain/storageCleanup");
  });

  it("classifies only known temporary cleanup prefixes", () => {
    expect(cleanup.classifyStorageCleanupKey("projects/project-1/images/image.png")).toMatchObject({
      category: "ABANDONED_PRESIGNED_UPLOAD",
      projectId: "project-1",
    });
    expect(cleanup.classifyStorageCleanupKey("projects/project-1/masks/image-1/mask.msk")).toMatchObject({
      category: "ABANDONED_PRESIGNED_UPLOAD",
      projectId: "project-1",
    });
    expect(cleanup.classifyStorageCleanupKey("projects/project-1/prediction-import-batches/batch-1/item.msk")).toMatchObject({
      category: "UNKNOWN_STAGING_OBJECT",
      projectId: "project-1",
      batchId: "batch-1",
    });
    expect(cleanup.classifyStorageCleanupKey("projects/project-1/prediction-import-batches/batch-1/source.zip")).toMatchObject({
      category: "BATCH_SOURCE_ZIP",
      projectId: "project-1",
      batchId: "batch-1",
    });
    expect(cleanup.classifyStorageCleanupKey("projects/project-1/exports/export-1/package.zip")).toBeNull();
    expect(cleanup.classifyStorageCleanupKey("projects/project-1/predictions/run-1/image-1/prediction.msk")).toBeNull();
  });

  it("calculates retention cutoffs and ages deterministically", () => {
    const now = new Date("2026-05-21T10:00:00.000Z");

    expect(cleanup.retentionCutoff(now, 7, "days").toISOString()).toBe("2026-05-14T10:00:00.000Z");
    expect(cleanup.retentionCutoff(now, 24, "hours").toISOString()).toBe("2026-05-20T10:00:00.000Z");
    expect(cleanup.ageSeconds(now, new Date("2026-05-21T09:59:30.000Z"))).toBe(30);
    expect(cleanup.ageSeconds(now, null)).toBeNull();
  });
});
