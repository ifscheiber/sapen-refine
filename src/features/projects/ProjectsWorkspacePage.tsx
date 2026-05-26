import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  decodeProjectRecencyCookie,
  PROJECT_RECENCY_COOKIE_NAME,
  sortProjectsByRecency,
} from "@/components/shell/projectRecency";
import { Button } from "@/components/ui/button";
import {
  WorkspaceContextRow,
  WorkspaceLocalTabs,
  WorkspaceMetaLabel,
  WorkspaceMetaRow,
  WorkspacePageHeader,
  WorkspacePageLayout,
  WorkspaceUtilityRail,
  WorkspaceUtilitySection,
} from "@/components/workspace/WorkspaceLayout";
import { AppEmptyState } from "@/components/shell/AppEmptyState";
import { ImagesClient } from "@/features/images/ImagesClient";
import { resolveProjectCreateCapability } from "@/server/auth/rbac";
import {
  canManageProject,
  canUploadImage,
  canViewCorrectionTasks,
  canViewPredictionImports,
  canViewProjectExports,
} from "@/server/auth/policies";
import { requireWorkspaceUser } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import { ProjectMetadataForm } from "./ProjectMetadataForm";
import { ProjectOperationsNav } from "./ProjectOperationsNav";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function roleLabel(value: string | null | undefined) {
  return value ?? "—";
}

function statRow(label: string, value: string | number) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

export async function ProjectsWorkspacePage({
  projectId,
  tab,
}: {
  projectId?: string;
  tab?: string | string[];
}) {
  const user = await requireWorkspaceUser();
  const [projectsRaw, cookieStore] = await Promise.all([
    prisma.annotationProject.findMany({
      where: { members: { some: { userId: user.id } } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { email: true, name: true } },
        labelSchemaVersion: { select: { name: true, version: true, status: true } },
        members: { where: { userId: user.id }, select: { role: true }, take: 1 },
        _count: {
          select: {
            images: true,
            tasks: true,
            exportBatches: true,
            predictionRuns: true,
            predictionImportBatches: true,
          },
        },
      },
    }),
    cookies(),
  ]);
  const projects = sortProjectsByRecency(
    projectsRaw,
    decodeProjectRecencyCookie(cookieStore.get(PROJECT_RECENCY_COOKIE_NAME)?.value),
  );

  if (projectId && !projects.some((project) => project.id === projectId)) {
    notFound();
  }

  const activeProject = projectId
    ? projects.find((project) => project.id === projectId)
    : projects[0];

  const activeTab = tab === "settings" ? "settings" : "images";
  const canCreateProject = activeProject ? false : await resolveProjectCreateCapability(user.id);

  if (!activeProject) {
    return (
      <WorkspacePageLayout
        header={
          <WorkspacePageHeader
            title="Projects"
            metadata={
              <WorkspaceMetaRow>
                <WorkspaceMetaLabel>Workspace</WorkspaceMetaLabel>
                <span className="text-[var(--text-primary)]">Project root</span>
                <span className="text-[var(--text-muted)]">•</span>
                <WorkspaceMetaLabel>Visible projects</WorkspaceMetaLabel>
                <span className="text-[var(--text-primary)]">0</span>
              </WorkspaceMetaRow>
            }
            actions={canCreateProject ? (
              <Button asChild>
                <Link href="/app/projects/new">New project</Link>
              </Button>
            ) : undefined}
          />
        }
        main={
          <AppEmptyState
            title="No projects yet"
            description={
              canCreateProject
                ? "Create the first annotation project to start uploading images."
                : "No annotation projects are visible for your account."
            }
            action={canCreateProject ? (
              <Button asChild>
                <Link href="/app/projects/new">New project</Link>
              </Button>
            ) : undefined}
          />
        }
      />
    );
  }

  const membershipRole = activeProject.members[0]?.role ?? null;
  const canEditProject = membershipRole ? canManageProject(membershipRole) : false;
  const canUpload = membershipRole ? canUploadImage(membershipRole) : false;
  const canViewOperations = membershipRole
    ? canViewProjectExports(membershipRole) ||
      canViewPredictionImports(membershipRole) ||
      canViewCorrectionTasks(membershipRole)
    : false;
  const effectiveTab = activeTab === "settings" ? "settings" : "images";
  const imagesHref = `/app/projects/${activeProject.id}`;
  const settingsHref = `/app/projects/${activeProject.id}?tab=settings`;
  const ownerLabel = activeProject.createdBy?.name ?? activeProject.createdBy?.email ?? "—";
  const localTabs = [
    { keyId: "project-images", label: "Images", href: imagesHref, active: effectiveTab === "images" },
    { keyId: "project-settings", label: "Project Settings", href: settingsHref, active: effectiveTab === "settings" },
  ];

  return (
    <WorkspacePageLayout
      header={
        <WorkspacePageHeader
          title={activeProject.name}
          metadata={
            <WorkspaceMetaRow>
              <WorkspaceMetaLabel>Workspace</WorkspaceMetaLabel>
              <span className="text-[var(--text-primary)]">Project root</span>
              <span className="text-[var(--text-muted)]">•</span>
              <WorkspaceMetaLabel>Images</WorkspaceMetaLabel>
              <span className="text-[var(--text-primary)]">{activeProject._count.images}</span>
              <span className="text-[var(--text-muted)]">•</span>
              <WorkspaceMetaLabel>Role</WorkspaceMetaLabel>
              <span className="text-[var(--text-primary)]">{roleLabel(membershipRole)}</span>
            </WorkspaceMetaRow>
          }
        />
      }
      contextRow={
        <WorkspaceContextRow>
          <div className="flex min-w-0 flex-wrap items-center gap-6">
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--text-dim)]">
                Project Workspace
              </div>
              <p className="mt-1 max-w-xl truncate text-sm font-semibold text-[var(--text-primary)]">
                {activeProject.description?.trim() || "Image annotation workspace"}
              </p>
            </div>
            <div className="hidden h-8 w-px bg-[var(--divider-subtle)] lg:block" />
            <div className="grid gap-3 text-xs sm:grid-cols-4">
              <div>
                <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Owner
                </div>
                <div className="mt-1 font-medium text-[var(--text-secondary)]">{ownerLabel}</div>
              </div>
              <div>
                <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Role
                </div>
                <div className="mt-1 font-medium text-[var(--text-secondary)]">
                  {roleLabel(membershipRole)}
                </div>
              </div>
              <div>
                <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Images
                </div>
                <div className="mt-1 font-medium text-[var(--text-secondary)]">
                  {activeProject._count.images}
                </div>
              </div>
              <div>
                <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Updated
                </div>
                <div className="mt-1 font-medium text-[var(--text-secondary)]">
                  {formatDate(activeProject.updatedAt)}
                </div>
              </div>
            </div>
          </div>
        </WorkspaceContextRow>
      }
      localTabs={<WorkspaceLocalTabs tabs={localTabs} />}
      main={
        effectiveTab === "settings" ? (
          <div className="pl-4">
            {canEditProject ? (
              <ProjectMetadataForm
                projectId={activeProject.id}
                initialName={activeProject.name}
                initialDescription={activeProject.description ?? ""}
                canEdit={canEditProject}
              />
            ) : (
              <section className="grid gap-4 text-sm">
                <div className="grid gap-3 border-b border-[var(--border-subtle)] pb-4">
                  {statRow("Name", activeProject.name)}
                  {statRow("Description", activeProject.description?.trim() || "—")}
                  {statRow("Owner", ownerLabel)}
                  {statRow("Role", roleLabel(membershipRole))}
                  {statRow("Images", activeProject._count.images)}
                  {statRow("Created", formatDate(activeProject.createdAt))}
                  {statRow("Updated", formatDate(activeProject.updatedAt))}
                </div>
                <p className="text-xs leading-5 text-[var(--text-secondary)]">
                  Project metadata editing is available to owner and QA roles.
                </p>
              </section>
            )}
          </div>
        ) : (
          <div className="pl-4">
            <ImagesClient projectId={activeProject.id} canUpload={canUpload} />
          </div>
        )
      }
      rail={
        <WorkspaceUtilityRail>
          <WorkspaceUtilitySection title="Project status">
            <div className="space-y-3">
              {statRow("Images", activeProject._count.images)}
              {canViewOperations ? statRow("Tasks", activeProject._count.tasks) : null}
              {canViewOperations ? statRow("Exports", activeProject._count.exportBatches) : null}
              {canViewOperations ? statRow("Prediction runs", activeProject._count.predictionRuns) : null}
              {canViewOperations ? statRow("Prediction imports", activeProject._count.predictionImportBatches) : null}
              {statRow(
                "Label schema",
                activeProject.labelSchemaVersion
                  ? `${activeProject.labelSchemaVersion.name} ${activeProject.labelSchemaVersion.version}`
                  : "Missing",
              )}
            </div>
          </WorkspaceUtilitySection>
          <WorkspaceUtilitySection title="Primary actions">
            <ProjectOperationsNav
              projectId={activeProject.id}
              current="overview"
              role={membershipRole ?? undefined}
              orientation="vertical"
            />
          </WorkspaceUtilitySection>
        </WorkspaceUtilityRail>
      }
    />
  );
}
