import { describe, expect, it } from "vitest";

import {
  attachmentContentDisposition,
  contentDispositionHeader,
  inlineContentDisposition,
  sanitizeContentDispositionFilename,
} from "@/server/http/contentDisposition";

describe("content disposition headers", () => {
  it("formats attachment and inline filenames with UTF-8 support", () => {
    expect(attachmentContentDisposition("sapen-export-123.zip")).toBe(
      "attachment; filename=\"sapen-export-123.zip\"; filename*=UTF-8''sapen-export-123.zip",
    );
    expect(inlineContentDisposition("slice 1.png")).toBe(
      "inline; filename=\"slice 1.png\"; filename*=UTF-8''slice%201.png",
    );
  });

  it("removes header-injection control characters", () => {
    const header = inlineContentDisposition("slice.png\r\nx-bad: yes", "image.bin");

    expect(header).toBe("inline; filename=\"slice.png x-bad: yes\"; filename*=UTF-8''slice.png%20x-bad%3A%20yes");
    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");
  });

  it("handles quotes, path separators, and backslashes", () => {
    expect(attachmentContentDisposition("../slice \"A\"\\mask.zip")).toBe(
      "attachment; filename=\".._slice \\\"A\\\"_mask.zip\"; filename*=UTF-8''.._slice%20%22A%22_mask.zip",
    );
  });

  it("provides ASCII fallback while preserving UTF-8 filename star", () => {
    expect(attachmentContentDisposition("café 铜.zip")).toBe(
      "attachment; filename=\"cafe _.zip\"; filename*=UTF-8''caf%C3%A9%20%E9%93%9C.zip",
    );
  });

  it("uses a stable fallback for blank names", () => {
    expect(sanitizeContentDispositionFilename("\r\n", "fallback.bin")).toBe("fallback.bin");
    expect(contentDispositionHeader("attachment", "", "fallback.bin")).toBe(
      "attachment; filename=\"fallback.bin\"; filename*=UTF-8''fallback.bin",
    );
  });
});
