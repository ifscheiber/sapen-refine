"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { apiListImages, apiListProjects, type ApiImage } from "@/lib/projectsClient";
import type { ShellProject } from "./AppShell";
import {
  parseEditorImageRoute,
  sortEditorSidebarImages,
  type EditorImageRouteContext,
} from "./editorShellContext";

export type ShellImage = Omit<ApiImage, "createdAt"> & {
  createdAt?: string | null;
};

type ImageLoadState = "idle" | "loading" | "loaded" | "error";

type AppShellContextValue = {
  pathname: string;
  editorRoute: EditorImageRouteContext | null;
  activeProject: ShellProjectSummary | null;
  activeImage: ShellImage | null;
  imageRows: ShellImage[];
  imageLoadState: ImageLoadState;
};

const AppShellContext = React.createContext<AppShellContextValue | null>(null);

type ShellProjectSummary = Pick<ShellProject, "id" | "name">;

function toProjectSummaries(projects: ShellProjectSummary[]) {
  return projects.map((project) => ({ id: project.id, name: project.name }));
}

function mergeProjectSummaries(
  current: ShellProjectSummary[],
  next: ShellProjectSummary[],
) {
  const merged = new Map(current.map((project) => [project.id, project]));
  for (const project of next) {
    merged.set(project.id, project);
  }
  return Array.from(merged.values());
}

function fallbackImage(imageId: string): ShellImage {
  return {
    id: imageId,
    filename: null,
    contentType: null,
    size: null,
    createdAt: null,
    updatedAt: null,
  };
}

export function AppShellContextProvider({
  projects,
  children,
}: {
  projects: ShellProject[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const editorRoute = React.useMemo(() => parseEditorImageRoute(pathname), [pathname]);
  const [clientProjects, setClientProjects] = React.useState<ShellProjectSummary[]>(() =>
    toProjectSummaries(projects),
  );
  const [imageCache, setImageCache] = React.useState<Record<string, ShellImage[]>>({});
  const [loadingProjectId, setLoadingProjectId] = React.useState<string | null>(null);
  const [failedProjectIds, setFailedProjectIds] = React.useState<Set<string>>(() => new Set());
  const activeProject =
    clientProjects.find((project) => project.id === editorRoute?.projectId) ?? null;

  React.useEffect(() => {
    setClientProjects((current) => mergeProjectSummaries(current, toProjectSummaries(projects)));
  }, [projects]);

  React.useEffect(() => {
    if (!editorRoute?.projectId) return;

    let cancelled = false;
    apiListProjects()
      .then((nextProjects) => {
        if (cancelled) return;
        setClientProjects((current) =>
          mergeProjectSummaries(current, toProjectSummaries(nextProjects)),
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [editorRoute?.projectId]);

  React.useEffect(() => {
    const projectId = editorRoute?.projectId;
    if (!projectId || imageCache[projectId] || failedProjectIds.has(projectId)) return;

    let cancelled = false;
    setLoadingProjectId(projectId);
    apiListImages(projectId)
      .then((images) => {
        if (cancelled) return;
        setImageCache((current) => ({ ...current, [projectId]: images }));
        setFailedProjectIds((current) => {
          if (!current.has(projectId)) return current;
          const next = new Set(current);
          next.delete(projectId);
          return next;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setFailedProjectIds((current) => new Set(current).add(projectId));
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingProjectId((current) => (current === projectId ? null : current));
      });

    return () => {
      cancelled = true;
    };
  }, [editorRoute?.projectId, failedProjectIds, imageCache]);

  const contextValue = React.useMemo<AppShellContextValue>(() => {
    if (!editorRoute) {
      return {
        pathname,
        editorRoute,
        activeProject: null,
        activeImage: null,
        imageRows: [],
        imageLoadState: "idle",
      };
    }

    const cachedImages = imageCache[editorRoute.projectId] ?? [];
    const activeImage =
      cachedImages.find((image) => image.id === editorRoute.imageId) ??
      fallbackImage(editorRoute.imageId);
    const rows = cachedImages.some((image) => image.id === editorRoute.imageId)
      ? cachedImages
      : [activeImage, ...cachedImages];
    const failed = failedProjectIds.has(editorRoute.projectId);
    const imageLoadState: ImageLoadState = failed
      ? "error"
      : loadingProjectId === editorRoute.projectId
        ? "loading"
        : imageCache[editorRoute.projectId]
          ? "loaded"
          : "idle";

    return {
      pathname,
      editorRoute,
      activeProject,
      activeImage,
      imageRows: sortEditorSidebarImages(rows, editorRoute.imageId),
      imageLoadState,
    };
  }, [activeProject, editorRoute, failedProjectIds, imageCache, loadingProjectId, pathname]);

  return <AppShellContext.Provider value={contextValue}>{children}</AppShellContext.Provider>;
}

export function useAppShellContext() {
  const context = React.useContext(AppShellContext);
  if (!context) throw new Error("AppShellContextProvider missing");
  return context;
}
