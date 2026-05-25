"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftIcon, ChevronRightIcon, FolderOpenIcon, PlusIcon, UploadIcon } from "lucide-react";

import {
  sidebarActionClassName,
  WorkspaceSidebarMetricRow,
  WorkspaceSidebarSection,
} from "@/components/workspace/WorkspaceSidebar";
import { cn } from "@/components/ui/utils";
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

function formatDateLabel(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toISOString().slice(0, 10);
}

function imageDisplayName(image: ShellImage | null, fallbackId: string) {
  return image?.filename ?? image?.id ?? fallbackId;
}

function imageUpdatedLabel(image: ShellImage | null) {
  return formatDateLabel(image?.updatedAt ?? image?.createdAt);
}

function imageRowSubtitle(image: ShellImage) {
  const updated = imageUpdatedLabel(image);
  return typeof image.sliceCount === "number"
    ? `${pluralizeSlices(image.sliceCount)} · Updated ${updated}`
    : `Updated ${updated}`;
}

export function AppSidebar({
  projects,
  canCreateProject,
}: {
  projects: ShellProject[];
  canCreateProject: boolean;
}) {
  const pathname = usePathname();
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

  if (editorRoute) {
    const projectName = editorProject?.name ?? editorRoute.projectId;
    const activeImageName = imageDisplayName(activeImage, editorRoute.imageId);
    const activeSliceCount =
      typeof activeImage?.sliceCount === "number" ? pluralizeSlices(activeImage.sliceCount) : "—";
    const activeUpdated = imageUpdatedLabel(activeImage);

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
              <WorkspaceSidebarMetricRow label="Updated" value={activeUpdated} />
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

                return (
                  <Link
                    key={image.id}
                    href={href}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "group relative flex min-h-[3.5rem] items-start gap-3.5 px-2 py-2.5 text-left transition-colors hover:bg-[var(--workspace-panel-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                      selected
                        ? "bg-[var(--workspace-selected)] text-[var(--text-primary)] before:absolute before:bottom-2.5 before:left-0 before:top-2.5 before:w-0.5 before:bg-[var(--accent-primary)]"
                        : "text-[var(--text-secondary)]",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-xs font-semibold",
                            selected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]",
                          )}
                          title={label}
                        >
                          {label}
                        </span>
                        <ChevronRightIcon
                          className={cn(
                            "size-4 shrink-0 text-[var(--text-dim)] transition-opacity",
                            selected ? "opacity-80" : "opacity-0 group-hover:opacity-50",
                          )}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="mt-1 block truncate text-[10px] font-medium text-[var(--text-muted)]">
                        {imageRowSubtitle(image)}
                      </span>
                    </span>
                  </Link>
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
            {activeProject ? (
              <Link href={`/app/projects/${activeProject.id}`} className={sidebarActionClassName}>
                <UploadIcon className="size-3.5" aria-hidden="true" />
                <span>Upload Images</span>
              </Link>
            ) : (
              <button type="button" disabled className={sidebarActionClassName}>
                <UploadIcon className="size-3.5" aria-hidden="true" />
                <span>Upload Images</span>
              </button>
            )}
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
                return (
                  <Link
                    key={project.id}
                    href={`/app/projects/${project.id}`}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "group relative flex min-h-[4rem] items-start gap-3.5 px-2 py-2.5 text-left transition-colors hover:bg-[var(--workspace-panel-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                      selected
                        ? "bg-[var(--workspace-selected)] text-[var(--text-primary)] before:absolute before:bottom-2.5 before:left-0 before:top-2.5 before:w-0.5 before:bg-[var(--accent-primary)]"
                        : "text-[var(--text-secondary)]",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-xs font-semibold",
                            selected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]",
                          )}
                        >
                          {project.name}
                        </span>
                        <ChevronRightIcon
                          className={cn(
                            "size-4 shrink-0 text-[var(--text-dim)] transition-opacity",
                            selected ? "opacity-80" : "opacity-0 group-hover:opacity-50",
                          )}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="mt-1 block truncate text-[10px] font-medium text-[var(--text-muted)]">
                        {pluralizeImages(project.imageCount)} · Updated {project.updatedLabel}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </WorkspaceSidebarSection>
      </div>
    </aside>
  );
}
