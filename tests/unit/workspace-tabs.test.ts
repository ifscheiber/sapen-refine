import { describe, expect, it } from "vitest";

import { workspaceTabKey, type WorkspaceTab } from "@/components/workspace/workspaceTabs";

describe("workspace tab keys", () => {
  it("uses explicit tab identities when multiple tabs share a route fallback", () => {
    const fallbackHref = "/app/projects/demo/images/image/crop/slices";
    const tabs: WorkspaceTab[] = [
      { keyId: "bboxes", label: "BBoxes", href: fallbackHref },
      { keyId: "semantic", label: "Semantic Masks", href: fallbackHref },
      { keyId: "export-readiness", label: "Export Readiness", href: `${fallbackHref}#export-readiness` },
    ];

    expect(tabs.map(workspaceTabKey)).toEqual(["bboxes", "semantic", "export-readiness"]);
    expect(new Set(tabs.map(workspaceTabKey)).size).toBe(tabs.length);
  });

  it("falls back to label and href for existing callers without explicit keys", () => {
    expect(workspaceTabKey({ label: "Images", href: "/app/projects/demo" })).toBe(
      "Images:/app/projects/demo",
    );
  });
});
