export async function fetchImageView(imageId: string) {
  const res = await fetch(`/api/images/${imageId}/view`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "IMAGE_VIEW_FAILED");
  return data as { url: string; filename?: string; contentType?: string };
}

// Get latest masks
export type LatestMaskResponse =
  | { ok: true; exists: false; maskId?: string }
  | {
      ok: true;
      exists: true;
      maskId: string;
      versionId: string;
      version: number;
      key: string;
      size: number;
      width: number;
      height: number;
      format: string;
      createdAt: string;
      url: string;
    };

export async function apiGetLatestMask(imageId: string): Promise<LatestMaskResponse> {
  const res = await fetch(`/api/images/${imageId}/mask/latest`, { method: "GET" });
  if (!res.ok) throw new Error(`MASK_LATEST_FAILED_${res.status}`);
  return res.json();
}


// Presign and Commit Masks
export async function apiPresignMask(imageId: string, contentType = "application/octet-stream") {
  const res = await fetch(`/api/images/${imageId}/mask/presign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "MASK_PRESIGN_FAILED");
  return data as { uploadUrl: string; key: string };
}

export async function apiCommitMask(imageId: string, args: {
  key: string;
  size: number;
  width: number;
  height: number;
  format: string; // "u8raw-v1"
}) {
  const res = await fetch(`/api/images/${imageId}/mask/commit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "MASK_COMMIT_FAILED");
  return data;
}
