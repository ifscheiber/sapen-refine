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
  checksum?: string | null;
  width?: number | null;
  height?: number | null;
  validationStatus?: string | null;
  uploadedAt?: string | null;
  uploadedBy?: { email: string; name: string | null } | null;
  sampleMetadata?: { tNumber: string | null } | null;
  createdAt: string;
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

export async function apiUploadImage(projectId: string, file: File): Promise<ApiImage> {
  const res = await fetch(`/api/projects/${projectId}/images/upload`, {
    method: "POST",
    headers: {
      "content-type": file.type || "application/octet-stream",
      "x-filename": encodeURIComponent(file.name),
    },
    body: file,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "UPLOAD_FAILED");
  return data.image;
}
