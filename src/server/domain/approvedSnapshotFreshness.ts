import { ArtifactReviewState } from "@prisma/client";

export const APPROVED_SNAPSHOT_FRESHNESS_POLICY = "block_newer_non_approved_versions";

export const APPROVED_SNAPSHOT_OUTDATED_REASON_CODES = [
  "SUPPORT_APPROVED_VERSION_OUTDATED",
  "SEMANTIC_APPROVED_VERSION_OUTDATED",
  "CLASSIFICATION_APPROVED_VERSION_OUTDATED",
] as const;

export type ApprovedSnapshotOutdatedReasonCode =
  typeof APPROVED_SNAPSHOT_OUTDATED_REASON_CODES[number];

export type ReviewableSnapshotVersion = {
  id: string;
  version: number;
  reviewState: ArtifactReviewState | string;
  createdAt: Date;
};

export function isApprovedSnapshotOutdated(params: {
  approved: ReviewableSnapshotVersion | null | undefined;
  latest: ReviewableSnapshotVersion | null | undefined;
}) {
  const { approved, latest } = params;
  if (!approved || !latest) return false;
  if (approved.id === latest.id) return false;
  if (latest.reviewState === ArtifactReviewState.APPROVED) return false;
  if (latest.reviewState === ArtifactReviewState.SUPERSEDED) return false;
  return latest.version > approved.version || latest.createdAt.getTime() > approved.createdAt.getTime();
}

export function isApprovedSnapshotOutdatedReasonCode(
  code: string,
): code is ApprovedSnapshotOutdatedReasonCode {
  return (APPROVED_SNAPSHOT_OUTDATED_REASON_CODES as readonly string[]).includes(code);
}
