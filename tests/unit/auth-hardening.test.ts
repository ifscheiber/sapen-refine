import { describe, expect, it } from "vitest";

import {
  canAnnotate,
  canCreateModelRun,
  canExportPredictionAnalysis,
  canExportTraining,
  canImportPrediction,
  canManageProject,
  canReadProject,
  canReview,
  canSubmitReview,
  canViewAudit,
} from "@/server/auth/policies";
import { sanitizeLoginRedirect } from "@/server/auth/redirects";
import {
  CROSS_SITE_MUTATION_ERROR,
  isApiMutationPath,
  isSameOriginMutationAllowed,
} from "@/server/auth/requestGuards";
import { shouldUpdateLastSeenAt } from "@/server/auth/sessionActivity";

describe("auth/RBAC policies", () => {
  it("keeps project role rules explicit", () => {
    expect(canReadProject("VIEWER")).toBe(true);
    expect(canManageProject("VIEWER")).toBe(false);
    expect(canManageProject("QA")).toBe(true);
    expect(canAnnotate("LABELER")).toBe(true);
    expect(canSubmitReview("LABELER")).toBe(true);
    expect(canReview("LABELER")).toBe(false);
    expect(canExportTraining("QA")).toBe(false);
    expect(canExportTraining("OWNER")).toBe(true);
    expect(canExportPredictionAnalysis("QA")).toBe(true);
    expect(canImportPrediction("QA")).toBe(true);
  });

  it("keeps global admin-only rules separate from project roles", () => {
    expect(canCreateModelRun(["USER"])).toBe(false);
    expect(canCreateModelRun(["ADMIN"])).toBe(true);
    expect(canViewAudit(["USER"])).toBe(false);
    expect(canViewAudit(["ADMIN"])).toBe(true);
  });
});

describe("login redirect sanitizer", () => {
  it("allows only app-relative redirects", () => {
    expect(sanitizeLoginRedirect("/app/projects?x=1")).toBe("/app/projects?x=1");
    expect(sanitizeLoginRedirect("/app/projects/demo#images")).toBe("/app/projects/demo#images");
  });

  it("falls back for absolute, protocol-relative, public, and malformed values", () => {
    expect(sanitizeLoginRedirect("https://evil.example/app")).toBe("/app");
    expect(sanitizeLoginRedirect("//evil.example/app")).toBe("/app");
    expect(sanitizeLoginRedirect("/api/projects")).toBe("/app");
    expect(sanitizeLoginRedirect("/login?next=/app")).toBe("/app");
    expect(sanitizeLoginRedirect(undefined)).toBe("/app");
  });
});

describe("same-origin mutation guard", () => {
  it("identifies unsafe API mutations", () => {
    expect(isApiMutationPath("/api/projects", "POST")).toBe(true);
    expect(isApiMutationPath("/api/projects", "GET")).toBe(false);
    expect(CROSS_SITE_MUTATION_ERROR).toBe("CROSS_SITE_MUTATION_REJECTED");
  });

  it("rejects cross-site browser mutations", () => {
    const headers = new Headers({ "sec-fetch-site": "cross-site" });
    expect(
      isSameOriginMutationAllowed({
        method: "POST",
        url: "https://annotate.example.com/api/projects",
        headers,
        appBaseUrl: "https://annotate.example.com",
      }),
    ).toBe(false);
  });

  it("allows same-origin and CLI-style mutations", () => {
    expect(
      isSameOriginMutationAllowed({
        method: "POST",
        url: "https://annotate.example.com/api/projects",
        headers: new Headers({ origin: "https://annotate.example.com" }),
        appBaseUrl: "https://annotate.example.com",
      }),
    ).toBe(true);
    expect(
      isSameOriginMutationAllowed({
        method: "POST",
        url: "https://annotate.example.com/api/projects",
        headers: new Headers(),
        appBaseUrl: "https://annotate.example.com",
      }),
    ).toBe(true);
  });
});

describe("session lastSeen throttle", () => {
  it("updates missing or stale lastSeen timestamps only", () => {
    const now = new Date("2026-05-21T08:00:00.000Z");
    expect(shouldUpdateLastSeenAt({ lastSeenAt: null, now, intervalSeconds: 900 })).toBe(true);
    expect(
      shouldUpdateLastSeenAt({
        lastSeenAt: new Date("2026-05-21T07:50:00.000Z"),
        now,
        intervalSeconds: 900,
      }),
    ).toBe(false);
    expect(
      shouldUpdateLastSeenAt({
        lastSeenAt: new Date("2026-05-21T07:45:00.000Z"),
        now,
        intervalSeconds: 900,
      }),
    ).toBe(true);
  });
});
