import { describe, expect, it } from "vitest";

import {
  readContentLength,
  uploadErrorPayload,
  validateUploadSize,
} from "@/server/uploads/validation";

describe("upload validation", () => {
  it("accepts positive sizes below the configured limit", () => {
    expect(validateUploadSize(1024, "image", 2048)).toEqual({
      ok: true,
      size: 1024,
      maxBytes: 2048,
    });
  });

  it("rejects missing or invalid sizes", () => {
    const validation = validateUploadSize(0, "mask", 2048);

    expect(validation).toEqual({
      ok: false,
      status: 400,
      error: "UPLOAD_SIZE_REQUIRED",
      maxBytes: 2048,
    });
  });

  it("rejects oversized uploads with a 413 payload", () => {
    const validation = validateUploadSize(4096, "image", 2048);

    expect(validation).toEqual({
      ok: false,
      status: 413,
      error: "UPLOAD_TOO_LARGE",
      maxBytes: 2048,
    });

    if (!validation.ok) {
      expect(uploadErrorPayload(validation)).toEqual({
        ok: false,
        error: "UPLOAD_TOO_LARGE",
        maxBytes: 2048,
      });
    }
  });

  it("parses valid content-length headers", () => {
    const headers = new Headers({ "content-length": "1234" });

    expect(readContentLength(headers)).toBe(1234);
  });

  it("ignores invalid content-length headers", () => {
    const headers = new Headers({ "content-length": "abc" });

    expect(readContentLength(headers)).toBeNull();
  });
});
