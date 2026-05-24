import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceHighCostRouteLimit: vi.fn(),
  requireUser: vi.fn(),
  runStorageCleanup: vi.fn(),
  storageCleanupErrorResponse: vi.fn(),
}));

vi.mock("@/server/auth/rbac", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/server/http/highCostRateLimit", () => ({
  enforceHighCostRouteLimit: mocks.enforceHighCostRouteLimit,
}));

vi.mock("@/server/domain/storageCleanup", () => ({
  runStorageCleanup: mocks.runStorageCleanup,
  storageCleanupErrorResponse: mocks.storageCleanupErrorResponse,
}));

describe("storage cleanup route contract", () => {
  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("preserves summary and results while adding consistency drift data", async () => {
    const cleanup = {
      options: {
        execute: false,
        category: "all",
        projectId: null,
        batchId: null,
        limit: 100,
        completedRetentionDays: 7,
        failedRetentionDays: 30,
        presignedRetentionHours: 24,
      },
      summary: {
        mode: "dry-run",
        totalResults: 1,
        wouldDeleteCount: 1,
        deletedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      },
      consistency: {
        hardDriftCount: 1,
        warningCount: 0,
        infoCount: 0,
        findingCount: 1,
        findings: [{
          code: "MISSING_REFERENCED_OBJECT",
          severity: "HARD_DRIFT",
          entity: "ImageAsset",
          entityId: "image-1",
          key: "projects/project-1/images/missing.png",
          projectId: "project-1",
        }],
      },
      results: [{
        key: "projects/project-1/images/orphan.png",
        category: "ABANDONED_PRESIGNED_UPLOAD",
        status: "WOULD_DELETE",
        reason: "PRESIGNED_UPLOAD_ORPHAN_RETENTION_EXPIRED",
        size: 12,
        ageSeconds: 3600,
        batchId: null,
        itemId: null,
        projectId: "project-1",
      }],
    };

    mocks.requireUser.mockResolvedValue({ id: "admin-1" });
    mocks.runStorageCleanup.mockResolvedValue(cleanup);

    const { POST } = await import("@/app/api/storage-cleanup/route");
    const response = await POST(new Request("http://local.test/api/storage-cleanup", {
      method: "POST",
      body: JSON.stringify({ dryRun: true }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      cleanup: expect.objectContaining({
        summary: cleanup.summary,
        results: cleanup.results,
        consistency: cleanup.consistency,
      }),
    });
    expect(mocks.runStorageCleanup).toHaveBeenCalledWith({
      actorId: "admin-1",
      input: { dryRun: true },
    });
  });
});
