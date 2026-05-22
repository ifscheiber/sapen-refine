import {
  readDeclaredMaskByteLength,
  UploadIntegrityError,
} from "@/server/uploads/integrity";
import {
  readContentLength,
  validateUploadSize,
} from "@/server/uploads/validation";

export type MaskUploadDiagnostics = {
  width: number | null;
  height: number | null;
  expectedBytes: number | null;
  receivedBytes: number | null;
  declaredClientBytes: number | null;
  contentLengthHeader: number | null;
  format: string;
};

export type MaskUploadRequest = {
  bytes: Uint8Array;
  width: number;
  height: number;
  format: string;
  declaredClientBytes: number | null;
  contentLengthHeader: number | null;
  expectedBytes: number;
  diagnostics: MaskUploadDiagnostics;
};

function readPositiveIntegerHeader(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function diagnostics(params: {
  width: number | null;
  height: number | null;
  receivedBytes: number | null;
  declaredClientBytes: number | null;
  contentLengthHeader: number | null;
  format: string;
}): MaskUploadDiagnostics {
  const expectedBytes =
    params.width && params.height && Number.isSafeInteger(params.width * params.height)
      ? params.width * params.height
      : null;

  return {
    width: params.width,
    height: params.height,
    expectedBytes,
    receivedBytes: params.receivedBytes,
    declaredClientBytes: params.declaredClientBytes,
    contentLengthHeader: params.contentLengthHeader,
    format: params.format,
  };
}

function maskUploadError(
  code: string,
  status: number,
  details: MaskUploadDiagnostics,
  maxBytes?: number,
) {
  return new UploadIntegrityError(code, status, code, details, maxBytes);
}

export async function readMaskUploadRequest(
  req: Request,
  options: { maxBytes?: number } = {},
): Promise<MaskUploadRequest> {
  const headers = req.headers;
  const width = readPositiveIntegerHeader(headers, "x-mask-width");
  const height = readPositiveIntegerHeader(headers, "x-mask-height");
  const format = headers.get("x-mask-format")?.trim() || "u8raw-v1";
  const declaredClientBytes = readDeclaredMaskByteLength(headers);
  const contentLengthHeader = readContentLength(headers);
  const baseDiagnostics = diagnostics({
    width,
    height,
    receivedBytes: null,
    declaredClientBytes,
    contentLengthHeader,
    format,
  });

  if (!width) throw maskUploadError("WIDTH_REQUIRED", 400, baseDiagnostics);
  if (!height) throw maskUploadError("HEIGHT_REQUIRED", 400, baseDiagnostics);

  if (contentLengthHeader !== null) {
    const earlyValidation = validateUploadSize(contentLengthHeader, "mask", options.maxBytes);
    if (!earlyValidation.ok) {
      throw maskUploadError(
        earlyValidation.error,
        earlyValidation.status,
        baseDiagnostics,
        earlyValidation.maxBytes,
      );
    }
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  const receivedDiagnostics = diagnostics({
    width,
    height,
    receivedBytes: bytes.byteLength,
    declaredClientBytes,
    contentLengthHeader,
    format,
  });
  const sizeValidation = validateUploadSize(bytes.byteLength, "mask", options.maxBytes);
  if (!sizeValidation.ok) {
    throw maskUploadError(
      sizeValidation.error,
      sizeValidation.status,
      receivedDiagnostics,
      sizeValidation.maxBytes,
    );
  }

  const expectedBytes = width * height;
  if (bytes.byteLength !== expectedBytes) {
    throw maskUploadError("MASK_BYTE_LENGTH_MISMATCH", 400, receivedDiagnostics);
  }

  return {
    bytes,
    width,
    height,
    format,
    declaredClientBytes,
    contentLengthHeader,
    expectedBytes,
    diagnostics: receivedDiagnostics,
  };
}

export function maskUploadDiagnosticsFromError(error: unknown): MaskUploadDiagnostics | null {
  if (error instanceof UploadIntegrityError && error.diagnostics) {
    return error.diagnostics as MaskUploadDiagnostics;
  }
  return null;
}
