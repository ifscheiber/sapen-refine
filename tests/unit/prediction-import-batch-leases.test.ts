import { describe, expect, it } from "vitest";
import { PredictionImportBatchItemStatus } from "@prisma/client";

import {
  calculateLeaseExpiresAt,
  isProcessingLeaseExpired,
  recoveredStatusForStaleItem,
  staleStartedBefore,
} from "@/server/domain/predictionImportBatchLeases";

describe("prediction import batch leases", () => {
  it("calculates lease expiry and stale legacy start thresholds", () => {
    const now = new Date("2026-05-21T08:00:00.000Z");

    expect(calculateLeaseExpiresAt(now, 900).toISOString()).toBe("2026-05-21T08:15:00.000Z");
    expect(staleStartedBefore(now, 900).toISOString()).toBe("2026-05-21T07:45:00.000Z");
  });

  it("detects expired explicit leases and legacy processing rows", () => {
    const now = new Date("2026-05-21T08:00:00.000Z");
    const status = PredictionImportBatchItemStatus.PROCESSING;

    expect(isProcessingLeaseExpired({
      status,
      leaseExpiresAt: new Date("2026-05-21T07:59:59.000Z"),
      startedAt: null,
    }, now, 900)).toBe(true);
    expect(isProcessingLeaseExpired({
      status,
      leaseExpiresAt: new Date("2026-05-21T08:00:01.000Z"),
      startedAt: new Date("2026-05-21T07:00:00.000Z"),
    }, now, 900)).toBe(false);
    expect(isProcessingLeaseExpired({
      status,
      leaseExpiresAt: null,
      startedAt: new Date("2026-05-21T07:44:59.000Z"),
    }, now, 900)).toBe(true);
  });

  it("recovers stale items to retry or failed based on remaining attempts", () => {
    expect(recoveredStatusForStaleItem({ attemptCount: 1, maxAttempts: 3 })).toBe(
      PredictionImportBatchItemStatus.RETRY_PENDING,
    );
    expect(recoveredStatusForStaleItem({ attemptCount: 3, maxAttempts: 3 })).toBe(
      PredictionImportBatchItemStatus.FAILED,
    );
  });
});
