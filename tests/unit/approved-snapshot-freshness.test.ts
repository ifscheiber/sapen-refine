import { describe, expect, it } from "vitest";
import { ArtifactReviewState } from "@prisma/client";

import { isApprovedSnapshotOutdated } from "@/server/domain/approvedSnapshotFreshness";

function version(params: {
  id: string;
  version: number;
  reviewState: ArtifactReviewState;
  createdAt: string;
}) {
  return {
    id: params.id,
    version: params.version,
    reviewState: params.reviewState,
    createdAt: new Date(params.createdAt),
  };
}

describe("approved snapshot freshness", () => {
  const approvedV1 = version({
    id: "approved-v1",
    version: 1,
    reviewState: ArtifactReviewState.APPROVED,
    createdAt: "2026-05-01T00:00:00.000Z",
  });

  it("blocks newer non-approved versions after the selected approved snapshot", () => {
    for (const reviewState of [
      ArtifactReviewState.DRAFT,
      ArtifactReviewState.SUBMITTED,
      ArtifactReviewState.REJECTED,
    ]) {
      expect(
        isApprovedSnapshotOutdated({
          approved: approvedV1,
          latest: version({
            id: `${reviewState.toLowerCase()}-v2`,
            version: 2,
            reviewState,
            createdAt: "2026-05-02T00:00:00.000Z",
          }),
        }),
      ).toBe(true);
    }
  });

  it("does not block when the newest version is approved or superseded", () => {
    expect(
      isApprovedSnapshotOutdated({
        approved: approvedV1,
        latest: version({
          id: "approved-v2",
          version: 2,
          reviewState: ArtifactReviewState.APPROVED,
          createdAt: "2026-05-02T00:00:00.000Z",
        }),
      }),
    ).toBe(false);
    expect(
      isApprovedSnapshotOutdated({
        approved: approvedV1,
        latest: version({
          id: "superseded-v2",
          version: 2,
          reviewState: ArtifactReviewState.SUPERSEDED,
          createdAt: "2026-05-02T00:00:00.000Z",
        }),
      }),
    ).toBe(false);
  });

  it("does not block unrelated older working versions", () => {
    expect(
      isApprovedSnapshotOutdated({
        approved: approvedV1,
        latest: version({
          id: "draft-v0",
          version: 0,
          reviewState: ArtifactReviewState.DRAFT,
          createdAt: "2026-04-30T00:00:00.000Z",
        }),
      }),
    ).toBe(false);
  });
});
