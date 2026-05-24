import { describe, expect, it } from "vitest";

import {
  evaluateHighCostRateLimit,
  policyForHighCostFamily,
} from "@/server/http/highCostRateLimit";
import type { RuntimeConfig } from "@/server/runtime/config";

const highCostConfig: RuntimeConfig["highCostLimits"] = {
  enabled: true,
  upload: { maxRequests: 2, windowSeconds: 60 },
  editorSave: { maxRequests: 120, windowSeconds: 60 },
  exportCreate: { maxRequests: 5, windowSeconds: 600 },
  predictionImport: { maxRequests: 10, windowSeconds: 600 },
  operations: { maxRequests: 3, windowSeconds: 900 },
};

describe("high-cost rate limit helpers", () => {
  it("maps route families to the intended policy group", () => {
    expect(policyForHighCostFamily("upload:image", highCostConfig)).toBe(highCostConfig.upload);
    expect(policyForHighCostFamily("upload:mask", highCostConfig)).toBe(highCostConfig.editorSave);
    expect(policyForHighCostFamily("save:crop-artifact", highCostConfig)).toBe(highCostConfig.editorSave);
    expect(policyForHighCostFamily("export:create", highCostConfig)).toBe(highCostConfig.exportCreate);
    expect(policyForHighCostFamily("prediction-import:process-or-retry", highCostConfig)).toBe(
      highCostConfig.predictionImport,
    );
    expect(policyForHighCostFamily("operations:cleanup-or-admin", highCostConfig)).toBe(
      highCostConfig.operations,
    );
  });

  it("allows requests at the configured threshold", () => {
    const now = new Date("2026-05-24T10:00:30.000Z");
    const result = evaluateHighCostRateLimit({
      requestCount: 2,
      windowStartedAt: new Date("2026-05-24T10:00:00.000Z"),
      policy: { maxRequests: 2, windowSeconds: 60 },
      now,
    });

    expect(result).toMatchObject({
      allowed: true,
      requestCount: 2,
      maxRequests: 2,
      retryAfterSeconds: 30,
    });
  });

  it("blocks requests over the configured threshold with retry seconds", () => {
    const now = new Date("2026-05-24T10:00:45.250Z");
    const result = evaluateHighCostRateLimit({
      requestCount: 3,
      windowStartedAt: new Date("2026-05-24T10:00:00.000Z"),
      policy: { maxRequests: 2, windowSeconds: 60 },
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(15);
  });
});
