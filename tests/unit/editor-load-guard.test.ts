import { describe, expect, it } from "vitest";

import { createEditorLoadGuard } from "@/features/editor/editorLoadGuard";

describe("editor load guard", () => {
  it("marks older loads stale when a newer load starts", () => {
    const ref = { current: 0 };

    const first = createEditorLoadGuard(ref);
    const second = createEditorLoadGuard(ref);

    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  it("marks aborted loads stale", () => {
    const ref = { current: 0 };
    const controller = new AbortController();
    const load = createEditorLoadGuard(ref, controller.signal);

    expect(load.isCurrent()).toBe(true);
    controller.abort();
    expect(load.isCurrent()).toBe(false);
  });
});
