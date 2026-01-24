export type ApiProject = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  myRole?: string | null;
};

export type ApiImage = {
  id: string;
  filename: string | null;
  contentType: string | null;
  size: number | null;
  createdAt: string;
  storageKey: string;
};

export async function apiListProjects(): Promise<ApiProject[]> {
  const res = await fetch("/api/projects", { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "PROJECTS_LOAD_FAILED");
  return Array.isArray(data?.projects) ? data.projects : [];
}

export async function apiCreateProject(name: string) {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "PROJECT_CREATE_FAILED");
  return data.project as { id: string; name: string };
}

export async function apiListImages(projectId: string): Promise<ApiImage[]> {
  const res = await fetch(`/api/projects/${projectId}/images`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "IMAGES_LOAD_FAILED");
  return Array.isArray(data?.images) ? data.images : [];
}

export async function apiGetImageViewUrl(projectId: string, imageId: string): Promise<string> {
  const res = await fetch(`/api/projects/${projectId}/images/${imageId}/view`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "IMAGE_VIEW_FAILED");
  return String(data?.url ?? "");
}

export async function apiPresignImageUpload(projectId: string, file: File) {
  const res = await fetch(`/api/projects/${projectId}/images/presign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "PRESIGN_FAILED");
  return data as { uploadUrl: string; key: string };
}

export async function apiCommitImage(projectId: string, args: { key: string; file: File }) {
  const res = await fetch(`/api/projects/${projectId}/images/commit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      key: args.key,
      filename: args.file.name,
      contentType: args.file.type || null,
      size: args.file.size,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "COMMIT_FAILED");
  return data.image;
}
