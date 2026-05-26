import { beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

let review: typeof import("@/server/domain/review");

describe("review domain helpers", () => {
  beforeAll(async () => {
    review = await import("@/server/domain/review");
  });

  it("allows only the MVP review state transitions", () => {
    expect(review.nextReviewStateForAction({ action: "submit", currentState: "DRAFT" })).toBe(
      "SUBMITTED",
    );
    expect(review.nextReviewStateForAction({ action: "approve", currentState: "SUBMITTED" })).toBe(
      "APPROVED",
    );
    expect(
      review.nextReviewStateForAction({
        action: "reject",
        currentState: "SUBMITTED",
        reason: "Needs cleaner boundary",
      }),
    ).toBe("REJECTED");
  });

  it("rejects terminal or out-of-order transitions", () => {
    expect(() =>
      review.nextReviewStateForAction({ action: "approve", currentState: "DRAFT" }),
    ).toThrow(
      review.ReviewWorkflowError,
    );
    expect(() =>
      review.nextReviewStateForAction({ action: "submit", currentState: "APPROVED" }),
    ).toThrow(review.ReviewWorkflowError);
    expect(() =>
      review.nextReviewStateForAction({
        action: "approve",
        currentState: "REJECTED",
      }),
    ).toThrow(review.ReviewWorkflowError);
  });

  it("requires a reason or comment for rejection", () => {
    expect(() =>
      review.nextReviewStateForAction({ action: "reject", currentState: "SUBMITTED" }),
    ).toThrow(review.ReviewWorkflowError);
    expect(
      review.nextReviewStateForAction({
        action: "reject",
        currentState: "SUBMITTED",
        comment: "  border too rough  ",
      }),
    ).toBe("REJECTED");
  });

  it("maps current project roles to submit and review capabilities", () => {
    expect(review.canSubmitReview("OWNER")).toBe(true);
    expect(review.canSubmitReview("QA")).toBe(true);
    expect(review.canSubmitReview("LABELER")).toBe(true);
    expect(review.canSubmitReview("VIEWER")).toBe(false);

    expect(review.canReview("OWNER")).toBe(true);
    expect(review.canReview("QA")).toBe(true);
    expect(review.canReview("LABELER")).toBe(false);
    expect(review.canReview("VIEWER")).toBe(false);
  });

  it("treats only approved versions as export-ready ground truth", () => {
    expect(review.isExportReadyState("APPROVED")).toBe(true);
    expect(review.isExportReadyState("SUBMITTED")).toBe(false);
    expect(review.isExportReadyState("DRAFT")).toBe(false);
    expect(review.isExportReadyState("REJECTED")).toBe(false);
    expect(review.isExportReadyState("SUPERSEDED")).toBe(false);
  });
});
