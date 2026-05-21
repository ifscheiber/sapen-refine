import { PredictionImportBatchItemStatus } from "@prisma/client";

export const BATCH_ITEM_STALE_PROCESSING_RECOVERED =
  "BATCH_ITEM_STALE_PROCESSING_RECOVERED";

export type LeaseCandidate = {
  status: PredictionImportBatchItemStatus;
  attemptCount: number;
  maxAttempts: number;
  startedAt: Date | null;
  leaseExpiresAt: Date | null;
};

export function calculateLeaseExpiresAt(now: Date, leaseSeconds: number) {
  return new Date(now.getTime() + leaseSeconds * 1000);
}

export function staleStartedBefore(now: Date, leaseSeconds: number) {
  return new Date(now.getTime() - leaseSeconds * 1000);
}

export function isProcessingLeaseExpired(
  item: Pick<LeaseCandidate, "status" | "startedAt" | "leaseExpiresAt">,
  now: Date,
  leaseSeconds: number,
) {
  if (item.status !== PredictionImportBatchItemStatus.PROCESSING) return false;
  if (item.leaseExpiresAt) return item.leaseExpiresAt.getTime() <= now.getTime();
  return Boolean(
    item.startedAt &&
      item.startedAt.getTime() <= staleStartedBefore(now, leaseSeconds).getTime(),
  );
}

export function recoveredStatusForStaleItem(
  item: Pick<LeaseCandidate, "attemptCount" | "maxAttempts">,
) {
  return item.attemptCount < item.maxAttempts
    ? PredictionImportBatchItemStatus.RETRY_PENDING
    : PredictionImportBatchItemStatus.FAILED;
}

export function processorRunSummary(params: {
  processorId: string;
  processorRunId: string;
  batchCount: number;
  processedCount: number;
  staleRecoveredCount: number;
}) {
  return {
    processorId: params.processorId,
    processorRunId: params.processorRunId,
    batchCount: params.batchCount,
    processedCount: params.processedCount,
    staleRecoveredCount: params.staleRecoveredCount,
  };
}
