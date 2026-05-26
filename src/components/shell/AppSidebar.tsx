"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftIcon, FolderOpenIcon, PlusIcon } from "lucide-react";

import {
  sidebarActionClassName,
  WorkspaceSidebarEntityRow,
  WorkspaceSidebarMetricRow,
  WorkspaceSidebarSection,
} from "@/components/workspace/WorkspaceSidebar";
import { formatRelativeTime, formatTimestamp } from "@/lib/relativeTime";
import { writeProjectRecencyCookie } from "./projectRecency";
import type { ShellProject } from "./AppShell";
import { useAppShellContext, type ShellImage } from "./AppShellContext";

function activeProjectIdFromPath(pathname: string) {
  const match = pathname.match(/^\/app\/projects\/([^/?#]+)/);
  if (!match) return null;
  const projectId = decodeURIComponent(match[1]);
  if (projectId === "new") return null;
  return projectId;
}

function pluralizeImages(count: number) {
  return count === 1 ? "1 image" : `${count} images`;
}

function pluralizeSlices(count: number) {
  return count === 1 ? "1 slice" : `${count} slices`;
}

function imageDisplayName(image: ShellImage | null, fallbackId: string) {
  return image?.filename ?? image?.id ?? fallbackId;
}

function imageUpdatedValue(image: ShellImage | null, now: Date) {
  const value = image?.updatedAt ?? image?.createdAt;
  return {
    label: value ? formatRelativeTime(value, now) : "—",
    title: value ? formatTimestamp(value) : undefined,
  };
}

function imageRowSubtitle(image: ShellImage, now: Date) {
  const updated = imageUpdatedValue(image, now);
  return typeof image.sliceCount === "number"
    ? `${pluralizeSlices(image.sliceCount)} · Updated ${updated.label}`
    : `Updated ${updated.label}`;
}

function projectUpdatedValue(project: ShellProject, now: Date) {
  const value = project.updatedAt ?? project.updatedLabel;
  return {
    label: formatRelativeTime(value, now),
    title: formatTimestamp(value),
  };
}

function projectRowSubtitle(project: ShellProject, now: Date) {
  const updated = projectUpdatedValue(project, now);
  return `${pluralizeImages(project.imageCount)} · Updated ${updated.label}`;
}

export function AppSidebar({
  projects,
  canCreateProject,
  initialNow,
}: {
  projects: ShellProject[];
  canCreateProject: boolean;
  initialNow: string;
}) {
  const pathname = usePathname();
  const [now, setNow] = useState(() => new Date(initialNow));
  const {
    editorRoute,
    activeProject: editorProject,
    activeImage,
    imageRows,
    imageLoadState,
  } = useAppShellContext();
  const projectIdFromPath = activeProjectIdFromPath(pathname);
  const activeProject =
    projects.find((project) => project.id === projectIdFromPath) ?? projects[0] ?? null;
  const visibleProjectIds = useMemo(() => projects.map((project) => project.id), [projects]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!projectIdFromPath) return;
    writeProjectRecencyCookie(projectIdFromPath, visibleProjectIds);
  }, [projectIdFromPath, visibleProjectIds]);

  if (editorRoute) {
    const projectName = editorProject?.name ?? editorRoute.projectId;
    const activeImageName = imageDisplayName(activeImage, editorRoute.imageId);
    const activeSliceCount =
      typeof activeImage?.sliceCount === "number" ? pluralizeSlices(activeImage.sliceCount) : "—";
    const activeUpdated = imageUpdatedValue(activeImage, now);

    return (
      <aside className="hidden w-[22rem] max-w-[78vw] shrink-0 overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--shell-sidebar-bg)] md:block">
        <div className="flex h-full min-h-0 flex-col py-6">
          <WorkspaceSidebarSection title="Image Summary">
            <div className="space-y-2">
              <WorkspaceSidebarMetricRow
                label="Active"
                value={<span title={activeImageName}>{activeImageName}</span>}
              />
              <WorkspaceSidebarMetricRow
                label="Project"
                value={<span title={projectName}>{projectName}</span>}
              />
              <WorkspaceSidebarMetricRow label="Slices" value={activeSliceCount} />
              <WorkspaceSidebarMetricRow
                label="Updated"
                value={<span title={activeUpdated.title}>{activeUpdated.label}</span>}
              />
            </div>
          </WorkspaceSidebarSection>

          <WorkspaceSidebarSection title="Actions">
            <Link href={`/app/projects/${editorRoute.projectId}`} className={sidebarActionClassName}>
              <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
              <span>Back to Project Images</span>
            </Link>
          </WorkspaceSidebarSection>

          <WorkspaceSidebarSection
            title="Images"
            className="flex min-h-0 flex-1 flex-col pr-0"
            contentClassName="min-h-0 flex-1 overflow-y-auto pl-0"
          >
            <div className="space-y-1 pr-2">
              {imageLoadState === "error" ? (
                <div className="pr-6 text-xs leading-5 text-[var(--text-secondary)]">
                  Images unavailable
                </div>
              ) : null}
              {imageLoadState === "loading" && imageRows.length <= 1 ? (
                <div className="pr-6 text-xs leading-5 text-[var(--text-secondary)]">
                  Loading images
                </div>
              ) : null}
              {imageRows.map((image) => {
                const selected = image.id === editorRoute.imageId;
                const label = imageDisplayName(image, image.id);
                const href = selected
                  ? editorRoute.currentPath
                  : `/app/projects/${editorRoute.projectId}/images/${image.id}/crop`;
                const updated = imageUpdatedValue(image, now);

                return (
                  <WorkspaceSidebarEntityRow
                    key={image.id}
                    href={href}
                    selected={selected}
                    title={label}
                    subtitle={imageRowSubtitle(image, now)}
                    subtitleTitle={updated.title}
                  />
                );
              })}
            </div>
          </WorkspaceSidebarSection>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden w-[22rem] max-w-[78vw] shrink-0 overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--shell-sidebar-bg)] md:block">
      <div className="flex h-full min-h-0 flex-col py-6">
        <WorkspaceSidebarSection title="Projects Summary">
          <div className="space-y-2">
            <WorkspaceSidebarMetricRow
              label="Active"
              value={
                <span title={activeProject?.name ?? "No project selected"}>
                  {activeProject?.name ?? "—"}
                </span>
              }
            />
            <WorkspaceSidebarMetricRow label="Projects" value={projects.length} />
            <WorkspaceSidebarMetricRow
              label="Images"
              value={activeProject ? activeProject.imageCount : "—"}
            />
            <WorkspaceSidebarMetricRow
              label="Open reviews"
              value={activeProject ? activeProject.openReviewCount : "—"}
            />
          </div>
        </WorkspaceSidebarSection>

        <WorkspaceSidebarSection title="Actions">
          <div className="space-y-1">
            {canCreateProject ? (
              <Link href="/app/projects/new" className={sidebarActionClassName}>
                <PlusIcon className="size-3.5" aria-hidden="true" />
                <span>New Project</span>
              </Link>
            ) : null}
            <Link href="/app/projects" className={sidebarActionClassName}>
              <FolderOpenIcon className="size-3.5" aria-hidden="true" />
              <span>Project Gallery</span>
            </Link>
          </div>
        </WorkspaceSidebarSection>

        <WorkspaceSidebarSection
          title="Projects"
          className="flex min-h-0 flex-1 flex-col pr-0"
          contentClassName="min-h-0 flex-1 overflow-y-auto pl-0"
        >
          {projects.length === 0 ? (
            <div className="pr-6 text-xs leading-5 text-[var(--text-secondary)]">
              {canCreateProject
                ? "No projects yet. Create the first annotation project to start uploading images."
                : "No annotation projects are visible for your account."}
            </div>
          ) : (
            <div className="space-y-1 pr-2">
              {projects.map((project) => {
                const selected = project.id === activeProject?.id;
                const updated = projectUpdatedValue(project, now);
                return (
                  <WorkspaceSidebarEntityRow
                    key={project.id}
                    href={`/app/projects/${project.id}`}
                    selected={selected}
                    title={project.name}
                    subtitle={projectRowSubtitle(project, now)}
                    subtitleTitle={updated.title}
                    onClick={() => writeProjectRecencyCookie(project.id, visibleProjectIds)}
                  />
                );
              })}
            </div>
          )}
        </WorkspaceSidebarSection>
      </div>
    </aside>
  );
}
