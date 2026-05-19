import { getRuntimeConfig } from "@/server/runtime/config";

export type UploadKind = "image" | "mask";

export type UploadSizeValidation =
  | { ok: true; size: number; maxBytes: number }
  | { ok: false; status: 400 | 413; error: string; maxBytes: number };

export function getUploadMaxBytes(kind: UploadKind): number {
  const { uploads } = getRuntimeConfig();
  return kind === "image" ? uploads.imageMaxBytes : uploads.maskMaxBytes;
}

export function readContentLength(headers: Headers): number | null {
  const value = headers.get("content-length");
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export function validateUploadSize(
  size: number,
  kind: UploadKind,
  maxBytes = getUploadMaxBytes(kind)
): UploadSizeValidation {
  if (!Number.isInteger(size) || size <= 0) {
    return { ok: false, status: 400, error: "UPLOAD_SIZE_REQUIRED", maxBytes };
  }

  if (size > maxBytes) {
    return { ok: false, status: 413, error: "UPLOAD_TOO_LARGE", maxBytes };
  }

  return { ok: true, size, maxBytes };
}

export function uploadErrorPayload(validation: Extract<UploadSizeValidation, { ok: false }>) {
  return {
    ok: false,
    error: validation.error,
    maxBytes: validation.maxBytes,
  };
}
