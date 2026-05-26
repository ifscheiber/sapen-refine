import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const enforcedRoutes = [
  {
    path: "src/app/api/projects/[projectId]/images/upload/route.ts",
    family: "upload:image",
  },
  {
    path: "src/app/api/images/[imageId]/mask/upload/route.ts",
    family: "upload:mask",
  },
  {
    path: "src/app/api/images/[imageId]/support-mask/upload/route.ts",
    family: "upload:mask",
  },
  {
    path: "src/app/api/slice-crops/[cropId]/support-mask/upload/route.ts",
    family: "save:crop-artifact",
  },
  {
    path: "src/app/api/slice-crops/[cropId]/semantic-mask/upload/route.ts",
    family: "save:crop-artifact",
  },
  {
    path: "src/app/api/correction-tasks/[taskId]/corrections/route.ts",
    family: "save:editor-artifact",
  },
  {
    path: "src/app/api/images/[imageId]/metadata/route.ts",
    family: "save:slice-metadata",
  },
  {
    path: "src/app/api/images/[imageId]/slice/ensure/route.ts",
    family: "save:slice-metadata",
  },
  {
    path: "src/app/api/images/[imageId]/slice/classification/route.ts",
    family: "save:slice-metadata",
  },
  {
    path: "src/app/api/slices/[sliceInstanceId]/classification/route.ts",
    family: "save:slice-metadata",
  },
  {
    path: "src/app/api/images/[imageId]/slice-bboxes/route.ts",
    family: "save:slice-metadata",
  },
  {
    path: "src/app/api/images/[imageId]/slice-bboxes/confirm/route.ts",
    family: "save:slice-metadata",
  },
  {
    path: "src/app/api/slice-bboxes/[bboxVersionId]/route.ts",
    family: "save:slice-metadata",
  },
  {
    path: "src/app/api/images/[imageId]/slice-crops/ensure/route.ts",
    family: "save:crop-artifact",
  },
  {
    path: "src/app/api/slice-bboxes/[bboxVersionId]/crop/route.ts",
    family: "save:crop-artifact",
  },
  {
    path: "src/app/api/projects/[projectId]/exports/route.ts",
    family: "export:create",
  },
  {
    path: "src/app/api/projects/[projectId]/prediction-analysis-exports/route.ts",
    family: "export:prediction-analysis-create",
  },
  {
    path: "src/app/api/prediction-runs/[predictionRunId]/batch-imports/route.ts",
    family: "prediction-import:upload",
  },
  {
    path: "src/app/api/prediction-runs/[predictionRunId]/predictions/route.ts",
    family: "prediction-import:upload",
  },
  {
    path: "src/app/api/prediction-import-batches/[batchId]/process/route.ts",
    family: "prediction-import:process-or-retry",
  },
  {
    path: "src/app/api/prediction-import-batches/[batchId]/retry/route.ts",
    family: "prediction-import:process-or-retry",
  },
  {
    path: "src/app/api/prediction-import-batches/process-due/route.ts",
    family: "prediction-import:process-or-retry",
  },
  {
    path: "src/app/api/export-jobs/process-due/route.ts",
    family: "operations:cleanup-or-admin",
  },
  {
    path: "src/app/api/storage-cleanup/route.ts",
    family: "operations:cleanup-or-admin",
  },
] as const;

describe("high-cost route inventory", () => {
  it("keeps representative expensive mutation routes wired to the shared limiter", () => {
    for (const route of enforcedRoutes) {
      const source = readFileSync(join(repoRoot, route.path), "utf8");
      expect(source, route.path).toContain("enforceHighCostRouteLimit");
      expect(source, route.path).toContain(`family: "${route.family}"`);
    }
  });
});
