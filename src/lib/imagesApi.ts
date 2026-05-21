export async function fetchImageView(imageId: string) {
  const res = await fetch(`/api/images/${imageId}/view`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "IMAGE_VIEW_FAILED");
  return data as { url: string; filename?: string; contentType?: string };
}

type MaskAuthor = { id?: string; email: string; name: string | null } | null;

export type LatestMaskResponse =
  | { ok: true; exists: false; maskId?: string }
  | {
      ok: true;
      exists: true;
      maskId: string;
      versionId: string;
      version: number;
      size: number;
      width: number;
      height: number;
      format: string;
      reviewState?: string;
      createdAt: string;
      createdBy?: MaskAuthor;
      url: string;
    };

export async function apiGetLatestMask(imageId: string): Promise<LatestMaskResponse> {
  const res = await fetch(`/api/images/${imageId}/mask/latest`, { method: "GET" });
  if (!res.ok) throw new Error(`MASK_LATEST_FAILED_${res.status}`);
  return res.json();
}

export type LatestSupportMaskResponse =
  | { ok: true; exists: false }
  | {
      ok: true;
      exists: true;
      versionId: string;
      version: number;
      size: number;
      width: number;
      height: number;
      format: string;
      reviewState: string;
      createdAt: string;
      createdBy: MaskAuthor;
      url: string;
    };

export async function apiGetLatestSupportMask(imageId: string): Promise<LatestSupportMaskResponse> {
  const res = await fetch(`/api/images/${imageId}/support-mask/latest`, { method: "GET" });
  if (!res.ok) throw new Error(`SUPPORT_MASK_LATEST_FAILED_${res.status}`);
  return res.json();
}

export type MaskUploadArgs = {
  bytes: BodyInit;
  width: number;
  height: number;
  format?: "u8raw-v1";
  checksum?: string;
  contentType?: string;
};

export type SemanticMaskUploadResponse = {
  ok: true;
  maskId: string;
  versionId: string;
  version: number;
  createdAt: string;
};

export type SupportMaskUploadResponse = {
  ok: true;
  sliceInstance: unknown;
  latestSupportMask: unknown;
};

function maskUploadHeaders(args: MaskUploadArgs): HeadersInit {
  const headers: Record<string, string> = {
    "content-type": args.contentType ?? "application/octet-stream",
    "x-mask-width": String(args.width),
    "x-mask-height": String(args.height),
    "x-mask-format": args.format ?? "u8raw-v1",
  };

  if (args.checksum) headers["x-checksum"] = args.checksum;
  return headers;
}

async function uploadMask<T>(endpoint: string, args: MaskUploadArgs): Promise<T> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: maskUploadHeaders(args),
    body: args.bytes,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "MASK_UPLOAD_FAILED");
  return data as T;
}

export function apiUploadSemanticMask(
  imageId: string,
  args: MaskUploadArgs,
): Promise<SemanticMaskUploadResponse> {
  return uploadMask<SemanticMaskUploadResponse>(`/api/images/${imageId}/mask/upload`, args);
}

export function apiUploadSupportMask(
  imageId: string,
  args: MaskUploadArgs,
): Promise<SupportMaskUploadResponse> {
  return uploadMask<SupportMaskUploadResponse>(`/api/images/${imageId}/support-mask/upload`, args);
}
