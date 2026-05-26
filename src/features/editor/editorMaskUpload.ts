export const MASK_UPLOAD_CONTENT_TYPE = "application/octet-stream";
export const MASK_UPLOAD_FORMAT = "u8raw-v1";

export type MaskUploadFormat = typeof MASK_UPLOAD_FORMAT;

export type EditorMaskUploadRequest = {
  body: Uint8Array<ArrayBuffer>;
  headers: Record<string, string>;
  byteLength: number;
  expectedByteLength: number;
};

export class EditorMaskUploadError extends Error {
  constructor(
    public readonly code: string,
    public readonly details: {
      width?: number;
      height?: number;
      expectedBytes?: number;
      actualBytes?: number;
      format?: MaskUploadFormat;
    } = {},
  ) {
    super(code);
  }
}

function assertPositiveInteger(value: number, code: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new EditorMaskUploadError(code);
  }
}

export function expectedMaskUploadByteLength(width: number, height: number) {
  assertPositiveInteger(width, "MASK_UPLOAD_WIDTH_INVALID");
  assertPositiveInteger(height, "MASK_UPLOAD_HEIGHT_INVALID");
  const expected = width * height;
  if (!Number.isSafeInteger(expected) || expected <= 0) {
    throw new EditorMaskUploadError("MASK_UPLOAD_BYTE_LENGTH_INVALID", {
      width,
      height,
    });
  }
  return expected;
}

export function buildEditorMaskUploadRequest(params: {
  data: Uint8Array;
  width: number;
  height: number;
  format?: MaskUploadFormat;
}): EditorMaskUploadRequest {
  const expectedByteLength = expectedMaskUploadByteLength(params.width, params.height);
  if (params.data.byteLength !== expectedByteLength) {
    throw new EditorMaskUploadError("MASK_CLIENT_BYTE_LENGTH_MISMATCH", {
      width: params.width,
      height: params.height,
      expectedBytes: expectedByteLength,
      actualBytes: params.data.byteLength,
      format: params.format ?? MASK_UPLOAD_FORMAT,
    });
  }

  const body = new Uint8Array(params.data.byteLength);
  body.set(params.data);

  return {
    body,
    byteLength: body.byteLength,
    expectedByteLength,
    headers: {
      "content-type": MASK_UPLOAD_CONTENT_TYPE,
      "x-mask-width": String(params.width),
      "x-mask-height": String(params.height),
      "x-mask-format": params.format ?? MASK_UPLOAD_FORMAT,
      "x-mask-byte-length": String(body.byteLength),
    },
  };
}

export async function uploadEditorMask(
  endpoint: string,
  params: {
    data: Uint8Array;
    width: number;
    height: number;
    format?: MaskUploadFormat;
    headers?: Record<string, string>;
  },
) {
  const request = buildEditorMaskUploadRequest(params);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { ...request.headers, ...(params.headers ?? {}) },
    body: request.body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`UPLOAD_FAILED ${response.status}: ${text}`);
  }

  return response;
}
