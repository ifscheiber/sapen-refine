import { describe, expect, it } from "vitest";

import {
  assertExportWithinTrialCaps,
  ExportTrialCapError,
} from "@/server/domain/exportTrialCaps";

describe("export trial caps", () => {
  it("allows export metrics inside item and byte caps", () => {
    expect(() =>
      assertExportWithinTrialCaps({
        metrics: { itemCount: 2, estimatedBytes: 1024 },
        limits: { maxItems: 2, maxBytes: 1024 },
        itemCode: "EXPORT_ITEM_LIMIT_EXCEEDED",
        byteCode: "EXPORT_BYTE_LIMIT_EXCEEDED",
      }),
    ).not.toThrow();
  });

  it("rejects item counts above the configured cap", () => {
    expect(() =>
      assertExportWithinTrialCaps({
        metrics: { itemCount: 3, estimatedBytes: 1024 },
        limits: { maxItems: 2, maxBytes: 4096 },
        itemCode: "EXPORT_ITEM_LIMIT_EXCEEDED",
        byteCode: "EXPORT_BYTE_LIMIT_EXCEEDED",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "EXPORT_ITEM_LIMIT_EXCEEDED",
        status: 413,
        details: expect.objectContaining({
          itemCount: 3,
          maxItems: 2,
        }),
      }) as ExportTrialCapError,
    );
  });

  it("rejects estimated bytes above the configured cap", () => {
    expect(() =>
      assertExportWithinTrialCaps({
        metrics: { itemCount: 1, estimatedBytes: 4097 },
        limits: { maxItems: 2, maxBytes: 4096 },
        itemCode: "PREDICTION_ANALYSIS_EXPORT_ITEM_LIMIT_EXCEEDED",
        byteCode: "PREDICTION_ANALYSIS_EXPORT_BYTE_LIMIT_EXCEEDED",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "PREDICTION_ANALYSIS_EXPORT_BYTE_LIMIT_EXCEEDED",
        status: 413,
        details: expect.objectContaining({
          estimatedBytes: 4097,
          maxBytes: 4096,
        }),
      }) as ExportTrialCapError,
    );
  });
});
