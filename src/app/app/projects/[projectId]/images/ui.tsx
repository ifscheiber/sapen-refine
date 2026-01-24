"use client";

import { useEffect, useState } from "react";
import Link from "next/link";



type ImageRow = {
  id: string;
  filename: string | null;
  contentType: string | null;
  size: number | null;
  createdAt: string;
  storageKey: string;
};

export function ImagesClient({
  projectId,
  canUpload,
}: {
  projectId: string;
  canUpload: boolean;
}) {
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/images`, {
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setImages([]);
      setError(data?.error ?? `LOAD_FAILED_${res.status}`);
      return;
    }

    setImages(Array.isArray(data?.images) ? data.images : []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function onPickFile(file: File) {
    setLoading(true);
    setError(null);

    try {
      // 1) presign
      const pres = await fetch(`/api/projects/${projectId}/images/presign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        }),
      });

      const presData = await pres.json().catch(() => null);
      if (!pres.ok) throw new Error(presData?.error ?? `PRESIGN_FAILED_${pres.status}`);

      const { uploadUrl, key } = presData as { uploadUrl: string; key: string };

      // 2) upload directly to MinIO
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!put.ok) throw new Error("UPLOAD_FAILED");

      // 3) commit to DB
      const commit = await fetch(`/api/projects/${projectId}/images/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key,
          filename: file.name,
          contentType: file.type || null,
          size: file.size,
        }),
      });

      const commitData = await commit.json().catch(() => null);
      if (!commit.ok) throw new Error(commitData?.error ?? `COMMIT_FAILED_${commit.status}`);

      await load();
    } catch (e: any) {
      setError(e?.message ?? "ERROR");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <label className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer">
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickFile(f);
              e.currentTarget.value = "";
            }}
          />
          <span>{loading ? "Uploading..." : "Upload image"}</span>
        </label>
      )}

      {error && <div className="rounded-lg border px-3 py-2 text-sm">{error}</div>}

      <div className="grid gap-2">
{images.map((img) => (
  <div key={img.id} className="rounded-lg border p-3 flex items-center gap-3">
    {/* optional thumbnail */}
    <div className="flex-1 min-w-0">
      <div className="font-medium truncate">{img.filename}</div>
      <div className="text-xs opacity-70">
        {img.contentType} · {img.size} bytes
      </div>
      <div className="text-xs opacity-70 truncate">
        key: {img.storageKey}
      </div>
    </div>

    <div className="flex items-center gap-2">
      <Link
        href={`/app/projects/${projectId}/images/${img.id}/edit`}
        className="inline-flex items-center rounded-md border px-3 py-1 text-sm hover:bg-zinc-50"
      >
        Open editor
      </Link>
    </div>
  </div>
))}


        {images.length === 0 && (
          <div className="rounded-xl border p-4 text-sm opacity-70">No images yet.</div>
        )}
      </div>
    </div>
  );
}
