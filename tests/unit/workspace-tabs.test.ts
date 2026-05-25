import { describe, expect, it } from "vitest";

import { workspaceTabKey, type WorkspaceTab } from "@/components/workspace/workspaceTabs";

describe("workspace tab keys", () => {
  it("uses explicit tab identities when multiple tabs share a route fallback", () => {
    const fallbackHref = "/app/projects/demo/images/image/crop/slices";
    const tabs: WorkspaceTab[] = [
      { keyId: "semantic", label: "Semantic Masks", href: fallbackHref },
      { keyId: "support", label: "Support Mask", href: fallbackHref },
      { keyId: "classification", label: "Classification", href: `${fallbackHref}#classification` },
    ];

    expect(tabs.map(workspaceTabKey)).toEqual(["semantic", "support", "classification"]);
    expect(new Set(tabs.map(workspaceTabKey)).size).toBe(tabs.length);
  });

  it("falls back to label and href for existing callers without explicit keys", () => {
    expect(workspaceTabKey({ label: "Images", href: "/app/projects/demo" })).toBe(
      "Images:/app/projects/demo",
    );
  });
});
