import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type RouteClassification = "public-api" | "protected-api";

const ROUTE_CLASSIFICATION: Record<string, RouteClassification> = {
  "src/app/api/artifact-versions/[versionId]/review/route.ts": "protected-api",
  "src/app/api/auth/login/route.ts": "public-api",
  "src/app/api/auth/logout/route.ts": "public-api",
  "src/app/api/auth/me/route.ts": "public-api",
  "src/app/api/correction-tasks/[taskId]/correction-context/route.ts": "protected-api",
  "src/app/api/correction-tasks/[taskId]/corrections/route.ts": "protected-api",
  "src/app/api/correction-tasks/[taskId]/prediction-mask/route.ts": "protected-api",
  "src/app/api/correction-tasks/[taskId]/route.ts": "protected-api",
  "src/app/api/export-jobs/process-due/route.ts": "protected-api",
  "src/app/api/exports/[exportId]/download/route.ts": "protected-api",
  "src/app/api/exports/[exportId]/route.ts": "protected-api",
  "src/app/api/health/route.ts": "public-api",
  "src/app/api/images/[imageId]/asset/route.ts": "protected-api",
  "src/app/api/images/[imageId]/mask/commit/route.ts": "protected-api",
  "src/app/api/images/[imageId]/mask/latest/route.ts": "protected-api",
  "src/app/api/images/[imageId]/mask/presign/route.ts": "protected-api",
  "src/app/api/images/[imageId]/mask/upload/route.ts": "protected-api",
  "src/app/api/images/[imageId]/mask/versions/[versionId]/asset/route.ts": "protected-api",
  "src/app/api/images/[imageId]/metadata/route.ts": "protected-api",
  "src/app/api/images/[imageId]/review-state/route.ts": "protected-api",
  "src/app/api/images/[imageId]/route.ts": "protected-api",
  "src/app/api/images/[imageId]/slice-bboxes/confirm/route.ts": "protected-api",
  "src/app/api/images/[imageId]/slice-bboxes/route.ts": "protected-api",
  "src/app/api/images/[imageId]/slice-crops/ensure/route.ts": "protected-api",
  "src/app/api/images/[imageId]/slice-crops/route.ts": "protected-api",
  "src/app/api/images/[imageId]/slice/classification/route.ts": "protected-api",
  "src/app/api/images/[imageId]/slice/ensure/route.ts": "protected-api",
  "src/app/api/images/[imageId]/slice/route.ts": "protected-api",
  "src/app/api/images/[imageId]/support-mask/latest/route.ts": "protected-api",
  "src/app/api/images/[imageId]/support-mask/upload/route.ts": "protected-api",
  "src/app/api/images/[imageId]/view/route.ts": "protected-api",
  "src/app/api/model-runs/[modelRunId]/route.ts": "protected-api",
  "src/app/api/model-runs/route.ts": "protected-api",
  "src/app/api/prediction-analysis-exports/[exportId]/download/route.ts": "protected-api",
  "src/app/api/prediction-analysis-exports/[exportId]/route.ts": "protected-api",
  "src/app/api/prediction-import-batches/[batchId]/items/route.ts": "protected-api",
  "src/app/api/prediction-import-batches/[batchId]/process/route.ts": "protected-api",
  "src/app/api/prediction-import-batches/[batchId]/retry/route.ts": "protected-api",
  "src/app/api/prediction-import-batches/[batchId]/route.ts": "protected-api",
  "src/app/api/prediction-import-batches/process-due/route.ts": "protected-api",
  "src/app/api/prediction-runs/[predictionRunId]/batch-imports/route.ts": "protected-api",
  "src/app/api/prediction-runs/[predictionRunId]/correction-tasks/route.ts": "protected-api",
  "src/app/api/prediction-runs/[predictionRunId]/predictions/route.ts": "protected-api",
  "src/app/api/prediction-runs/[predictionRunId]/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/correction-tasks/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/crop-readiness/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/export/readiness/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/exports/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/images/[imageId]/view/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/images/commit/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/images/presign/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/images/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/images/upload/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/prediction-analysis-export/readiness/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/prediction-analysis-exports/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/prediction-import-batches/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/prediction-runs/route.ts": "protected-api",
  "src/app/api/projects/[projectId]/route.ts": "protected-api",
  "src/app/api/projects/route.ts": "protected-api",
  "src/app/api/ready/route.ts": "public-api",
  "src/app/api/slice-bboxes/[bboxVersionId]/crop/route.ts": "protected-api",
  "src/app/api/slice-bboxes/[bboxVersionId]/route.ts": "protected-api",
  "src/app/api/slice-classification-versions/[versionId]/review/route.ts": "protected-api",
  "src/app/api/slice-crops/[cropId]/asset/route.ts": "protected-api",
  "src/app/api/slice-crops/[cropId]/route.ts": "protected-api",
  "src/app/api/slice-crops/[cropId]/semantic-mask/route.ts": "protected-api",
  "src/app/api/slice-crops/[cropId]/semantic-mask/upload/route.ts": "protected-api",
  "src/app/api/slice-crops/[cropId]/support-mask/route.ts": "protected-api",
  "src/app/api/slice-crops/[cropId]/support-mask/upload/route.ts": "protected-api",
  "src/app/api/slices/[sliceInstanceId]/classification/route.ts": "protected-api",
  "src/app/api/storage-cleanup/route.ts": "protected-api",
};

const HTTP_METHOD_EXPORT = /\bexport\s+(?:const|async function)\s+(GET|POST|PATCH|DELETE|PUT|HEAD|OPTIONS)\b/g;
const WRAPPED_HTTP_METHOD_EXPORT =
  /\bexport\s+const\s+(GET|POST|PATCH|DELETE|PUT|HEAD|OPTIONS)\s*=\s*withApiErrorHandling\s*\(/g;

function routeFiles(dir = path.resolve("src/app/api")): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const absolute = path.join(dir, entry);
    if (statSync(absolute).isDirectory()) return routeFiles(absolute);
    if (!absolute.endsWith("/route.ts")) return [];
    return path.relative(process.cwd(), absolute).split(path.sep).join("/");
  }).sort();
}

function exportedMethods(source: string) {
  return Array.from(source.matchAll(HTTP_METHOD_EXPORT), (match) => match[1]).sort();
}

function wrappedExportedMethods(source: string) {
  return Array.from(source.matchAll(WRAPPED_HTTP_METHOD_EXPORT), (match) => match[1]).sort();
}

describe("api route error contracts", () => {
  it("classifies every app api route", () => {
    expect(Object.keys(ROUTE_CLASSIFICATION).sort()).toEqual(routeFiles());
  });

  it("requires auth-calling routes to be protected", () => {
    for (const file of routeFiles()) {
      const source = readFileSync(file, "utf8");
      const callsAuth = /requireUser\s*\(|requireProjectRole\s*\(/.test(source);
      if (callsAuth) {
        expect(ROUTE_CLASSIFICATION[file], file).toBe("protected-api");
      }
    }
  });

  it("wraps every protected http method export with withApiErrorHandling", () => {
    for (const [file, classification] of Object.entries(ROUTE_CLASSIFICATION)) {
      if (classification !== "protected-api") continue;

      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("withApiErrorHandling");
      expect(wrappedExportedMethods(source), file).toEqual(exportedMethods(source));
      expect(source, file).not.toMatch(/\bexport\s+async\s+function\s+(GET|POST|PATCH|DELETE|PUT|HEAD|OPTIONS)\b/);
    }
  });
});
