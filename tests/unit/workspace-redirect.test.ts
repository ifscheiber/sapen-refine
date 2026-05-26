import { describe, expect, it } from "vitest";

import { workspaceLoginRedirectTarget } from "@/server/auth/workspaceRedirect";

describe("workspace login redirects", () => {
  it("preserves valid workspace paths", () => {
    expect(
      workspaceLoginRedirectTarget("/app/projects/demo_project/images/image-1/crop?stage=bboxes"),
    ).toBe(
      "/login?next=%2Fapp%2Fprojects%2Fdemo_project%2Fimages%2Fimage-1%2Fcrop%3Fstage%3Dbboxes",
    );
  });

  it("falls back to the app root for invalid paths", () => {
    expect(workspaceLoginRedirectTarget(null)).toBe("/login?next=%2Fapp");
    expect(workspaceLoginRedirectTarget("/api/projects")).toBe("/login?next=%2Fapp");
    expect(workspaceLoginRedirectTarget("//evil.example/app")).toBe("/login?next=%2Fapp");
  });
});
