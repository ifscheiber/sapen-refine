import crypto from "crypto";

export type SupportedImageContentType = "image/png" | "image/jpeg";

export class UploadIntegrityError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    message = code,
    public readonly diagnostics: Record<string, unknown> | null = null,
    public readonly maxBytes: number | null = null,
  ) {
    super(message);
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const SUPPORTED_IMAGE_TYPES = new Set<SupportedImageContentType>(["image/png", "image/jpeg"]);
const JPEG_SOF_MARKERS = new Set([
  0xc0,
  0xc1,
  0xc2,
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf,
]);

export function sha256Checksum(bytes: Uint8Array | string) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

export function normalizeChecksum(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (/^sha256:[0-9a-f]{64}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-f]{64}$/.test(trimmed)) return `sha256:${trimmed}`;
  return null;
}

export function assertChecksumMatches(expected: string | null | undefined, actual: string) {
  const normalized = normalizeChecksum(expected);
  if (normalized && normalized !== actual) {
    throw new UploadIntegrityError("CHECKSUM_MISMATCH");
  }
}

export function normalizeContentType(value: string | null | undefined) {
  return value?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

export function assertSupportedImageContentType(value: string | null | undefined): SupportedImageContentType {
  const contentType = normalizeContentType(value);
  if (!SUPPORTED_IMAGE_TYPES.has(contentType as SupportedImageContentType)) {
    throw new UploadIntegrityError("UNSUPPORTED_CONTENT_TYPE", 415);
  }
  return contentType as SupportedImageContentType;
}

function readUint32BE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  );
}

function readUint16BE(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] ?? 0) << 8) + (bytes[offset + 1] ?? 0);
}

function readPngDimensions(bytes: Uint8Array) {
  if (bytes.byteLength < 24) throw new UploadIntegrityError("IMAGE_DIMENSIONS_UNREADABLE");
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw new UploadIntegrityError("IMAGE_DIMENSIONS_UNREADABLE");
  }

  const chunkType = String.fromCharCode(bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0);
  if (chunkType !== "IHDR") throw new UploadIntegrityError("IMAGE_DIMENSIONS_UNREADABLE");

  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new UploadIntegrityError("IMAGE_DIMENSIONS_UNREADABLE");
  }
  return { width, height };
}

function readJpegDimensions(bytes: Uint8Array) {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new UploadIntegrityError("IMAGE_DIMENSIONS_UNREADABLE");
  }

  let offset = 2;
  while (offset < bytes.byteLength) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;

    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;

    if (offset + 2 > bytes.byteLength) break;
    const segmentLength = readUint16BE(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) break;

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (segmentLength < 7) break;
      const height = readUint16BE(bytes, offset + 3);
      const width = readUint16BE(bytes, offset + 5);
      if (width > 0 && height > 0) return { width, height };
      break;
    }

    offset += segmentLength;
  }

  throw new UploadIntegrityError("IMAGE_DIMENSIONS_UNREADABLE");
}

export function readImageDimensions(bytes: Uint8Array, contentType: SupportedImageContentType) {
  return contentType === "image/png" ? readPngDimensions(bytes) : readJpegDimensions(bytes);
}

export function validateImageBytes(params: {
  bytes: Uint8Array;
  contentType: string | null | undefined;
  expectedChecksum?: string | null;
}) {
  const contentType = assertSupportedImageContentType(params.contentType);
  const dimensions = readImageDimensions(params.bytes, contentType);
  const checksum = sha256Checksum(params.bytes);
  assertChecksumMatches(params.expectedChecksum, checksum);

  return {
    contentType,
    checksum,
    width: dimensions.width,
    height: dimensions.height,
    size: params.bytes.byteLength,
  };
}

export function validateMaskBytes(params: {
  bytes: Uint8Array;
  width: number;
  height: number;
  imageWidth?: number | null;
  imageHeight?: number | null;
  format?: string | null;
  expectedChecksum?: string | null;
}) {
  const format = params.format?.trim() || "u8raw-v1";
  if (format !== "u8raw-v1") throw new UploadIntegrityError("MASK_FORMAT_UNSUPPORTED");
  if (!Number.isInteger(params.width) || params.width <= 0) throw new UploadIntegrityError("WIDTH_REQUIRED");
  if (!Number.isInteger(params.height) || params.height <= 0) throw new UploadIntegrityError("HEIGHT_REQUIRED");
  if (params.bytes.byteLength !== params.width * params.height) {
    throw new UploadIntegrityError("MASK_BYTE_LENGTH_MISMATCH");
  }
  if (
    (params.imageWidth && params.imageWidth !== params.width) ||
    (params.imageHeight && params.imageHeight !== params.height)
  ) {
    throw new UploadIntegrityError("MASK_DIMENSIONS_MISMATCH");
  }

  const checksum = sha256Checksum(params.bytes);
  assertChecksumMatches(params.expectedChecksum, checksum);
  return {
    checksum,
    width: params.width,
    height: params.height,
    size: params.bytes.byteLength,
    format,
  };
}

export function validateSupportMaskValues(bytes: Uint8Array, supportByte: number) {
  if (!Number.isInteger(supportByte) || supportByte <= 0 || supportByte > 255) {
    throw new UploadIntegrityError("SLICE_SUPPORT_LABEL_INVALID");
  }
  for (const value of bytes) {
    if (value !== 0 && value !== supportByte) {
      throw new UploadIntegrityError("SUPPORT_MASK_VALUES_INVALID");
    }
  }
}

export function readDeclaredMaskByteLength(headers: Headers) {
  const value = headers.get("x-mask-byte-length");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function maskByteLengthDiagnostics(params: {
  width: number;
  height: number;
  receivedBytes: number;
  declaredClientBytes?: number | null;
  contentLengthHeader?: number | null;
  format?: string | null;
}) {
  return {
    expectedBytes: params.width * params.height,
    receivedBytes: params.receivedBytes,
    declaredClientBytes: params.declaredClientBytes ?? null,
    contentLengthHeader: params.contentLengthHeader ?? null,
    format: params.format?.trim() || "u8raw-v1",
  };
}

export function integrityErrorPayload(error: unknown) {
  if (error instanceof UploadIntegrityError) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: error.code,
        ...(typeof error.maxBytes === "number" ? { maxBytes: error.maxBytes } : {}),
      },
    };
  }
  return null;
}
