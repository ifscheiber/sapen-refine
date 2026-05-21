import { describe, expect, it } from "vitest";

import {
  readContentLength,
  uploadErrorPayload,
  validateUploadSize,
} from "@/server/uploads/validation";
import {
  normalizeChecksum,
  readImageDimensions,
  readDeclaredMaskByteLength,
  maskByteLengthDiagnostics,
  sha256Checksum,
  UploadIntegrityError,
  validateImageBytes,
  validateMaskBytes,
  validateSupportMaskValues,
} from "@/server/uploads/integrity";

function minimalPng(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes[16] = (width >>> 24) & 0xff;
  bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff;
  bytes[21] = (height >>> 16) & 0xff;
  bytes[22] = (height >>> 8) & 0xff;
  bytes[23] = height & 0xff;
  return bytes;
}

function minimalJpeg(width: number, height: number) {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    (height >>> 8) & 0xff,
    height & 0xff,
    (width >>> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x00,
    0x03,
    0x11,
    0x00,
    0xff,
    0xd9,
  ]);
}

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

  it("formats and normalizes sha256 checksums", () => {
    const checksum = sha256Checksum(new Uint8Array([1, 2, 3]));

    expect(checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(normalizeChecksum(checksum.replace("sha256:", ""))).toBe(checksum);
  });

  it("extracts PNG and JPEG dimensions", () => {
    expect(readImageDimensions(minimalPng(12, 9), "image/png")).toEqual({ width: 12, height: 9 });
    expect(readImageDimensions(minimalJpeg(8, 6), "image/jpeg")).toEqual({ width: 8, height: 6 });
  });

  it("validates image bytes and rejects unsupported content types", () => {
    const bytes = minimalPng(5, 4);
    const validation = validateImageBytes({ bytes, contentType: "image/png; charset=binary" });

    expect(validation).toMatchObject({
      contentType: "image/png",
      width: 5,
      height: 4,
      size: bytes.byteLength,
    });

    expect(() => validateImageBytes({ bytes, contentType: "image/svg+xml" })).toThrow(
      new UploadIntegrityError("UNSUPPORTED_CONTENT_TYPE", 415),
    );
  });

  it("validates raw u8 mask dimensions and support mask values", () => {
    const bytes = new Uint8Array([0, 10, 0, 10]);

    expect(
      validateMaskBytes({
        bytes,
        width: 2,
        height: 2,
        imageWidth: 2,
        imageHeight: 2,
        format: "u8raw-v1",
      }),
    ).toMatchObject({ width: 2, height: 2, size: 4 });
    expect(() => validateMaskBytes({ bytes, width: 4, height: 4 })).toThrow(
      new UploadIntegrityError("MASK_BYTE_LENGTH_MISMATCH"),
    );
    expect(() => validateMaskBytes({ bytes, width: 2, height: 2, imageWidth: 3 })).toThrow(
      new UploadIntegrityError("MASK_DIMENSIONS_MISMATCH"),
    );

    expect(() => validateSupportMaskValues(bytes, 10)).not.toThrow();
    expect(() => validateSupportMaskValues(new Uint8Array([0, 3]), 10)).toThrow(
      new UploadIntegrityError("SUPPORT_MASK_VALUES_INVALID"),
    );
  });

  it("treats declared mask byte length as diagnostics only", () => {
    expect(readDeclaredMaskByteLength(new Headers({ "x-mask-byte-length": "4" }))).toBe(4);
    expect(readDeclaredMaskByteLength(new Headers({ "x-mask-byte-length": "NaN" }))).toBeNull();

    const bytes = new Uint8Array([0, 10, 0, 10]);
    expect(
      validateMaskBytes({
        bytes,
        width: 2,
        height: 2,
        format: "u8raw-v1",
      }),
    ).toMatchObject({ size: 4 });

    expect(maskByteLengthDiagnostics({
      width: 2,
      height: 2,
      receivedBytes: bytes.byteLength,
      declaredClientBytes: 999,
      format: "u8raw-v1",
    })).toEqual({
      expectedBytes: 4,
      receivedBytes: 4,
      declaredClientBytes: 999,
      format: "u8raw-v1",
    });
  });
});
