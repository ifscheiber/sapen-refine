import { describe, expect, it } from "vitest";

import { formatRelativeTime, formatTimestamp } from "@/lib/relativeTime";

describe("relative time formatting", () => {
  const now = new Date("2026-05-25T12:00:00.000Z");

  it("matches the compact core/refine relative labels", () => {
    expect(formatRelativeTime("2026-05-25T11:59:30.000Z", now)).toBe("now");
    expect(formatRelativeTime("2026-05-25T11:58:00.000Z", now)).toBe("2 min ago");
    expect(formatRelativeTime("2026-05-25T09:00:00.000Z", now)).toBe("3 h ago");
    expect(formatRelativeTime("2026-05-20T12:00:00.000Z", now)).toBe("5 d ago");
    expect(formatRelativeTime("2026-04-25T12:00:00.000Z", now)).toBe("1 mo ago");
  });

  it("handles future and invalid timestamps", () => {
    expect(formatRelativeTime("2026-05-25T14:00:00.000Z", now)).toBe("in 2 h");
    expect(formatRelativeTime("not-a-date", now)).toBe("date missing");
    expect(formatTimestamp("not-a-date")).toBe("date missing");
  });

  it("formats timestamps deterministically for server/client hydration", () => {
    expect(formatTimestamp("2026-05-25T12:00:00.000Z")).toBe("May 25, 2026, 12:00 PM");
  });
});
