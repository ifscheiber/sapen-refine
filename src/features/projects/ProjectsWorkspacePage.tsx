import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  WorkspaceContextRow,
  WorkspaceLocalTabs,
  WorkspaceMetaLabel,
  WorkspaceMetaRow,
  WorkspacePageHeader,
  WorkspacePageLayout,
  WorkspaceTopTabs,
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
  const projects = await prisma.annotationProject.findMany({
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
  });

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
        topTabs={<WorkspaceTopTabs tabs={[{ label: "Projects", href: "/app/projects", active: true }]} />}
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
  const effectiveTab = activeTab === "settings" && canEditProject ? "settings" : "images";
  const projectRootHref = `/app/projects/${activeProject.id}`;
  const settingsHref = `/app/projects/${activeProject.id}?tab=settings`;
  const ownerLabel = activeProject.createdBy?.name ?? activeProject.createdBy?.email ?? "—";
  const localTabs = [
    { label: "Images", href: projectRootHref, active: effectiveTab === "images" },
    ...(canEditProject
      ? [{ label: "Project Settings", href: settingsHref, active: effectiveTab === "settings" }]
      : []),
  ];

  return (
    <WorkspacePageLayout
      topTabs={<WorkspaceTopTabs tabs={[{ label: "Projects", href: "/app/projects", active: true }]} />}
      header={
        <WorkspacePageHeader
          title="Projects"
          metadata={
            <WorkspaceMetaRow>
              <WorkspaceMetaLabel>Workspace</WorkspaceMetaLabel>
              <span className="text-[var(--text-primary)]">Project root</span>
              <span className="text-[var(--text-muted)]">•</span>
              <WorkspaceMetaLabel>Visible projects</WorkspaceMetaLabel>
              <span className="text-[var(--text-primary)]">{projects.length}</span>
            </WorkspaceMetaRow>
          }
        />
      }
      contextRow={
        <WorkspaceContextRow>
          <div className="flex min-w-0 flex-wrap items-center gap-6">
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--text-dim)]">
                Active Project
              </div>
              <h2 className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                {activeProject.name}
              </h2>
            </div>
            <div className="hidden h-8 w-px bg-[var(--divider-subtle)] lg:block" />
            <div className="grid gap-3 text-xs sm:grid-cols-3">
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
      localTabs={
        <WorkspaceLocalTabs
          tabs={localTabs}
        />
      }
      main={
        effectiveTab === "settings" ? (
          <div className="pl-4">
            <ProjectMetadataForm
              projectId={activeProject.id}
              initialName={activeProject.name}
              initialDescription={activeProject.description ?? ""}
              canEdit={canEditProject}
            />
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
              current={effectiveTab === "images" ? "images" : "overview"}
              role={membershipRole ?? undefined}
              orientation="vertical"
            />
          </WorkspaceUtilitySection>
        </WorkspaceUtilityRail>
      }
    />
  );
}
