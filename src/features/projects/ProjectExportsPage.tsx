import { notFound } from "next/navigation";

import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { AppSection } from "@/components/shell/AppSection";
import { canViewProjectExports, PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import { ProjectExportPanel } from "./ProjectExportPanel";
import { ProjectOperationsNav } from "./ProjectOperationsNav";

export async function ProjectExportsPage({ projectId }: { projectId: string }) {
  const { membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);
  if (!canViewProjectExports(membership.role)) return notFound();

  const project = await prisma.annotationProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) return notFound();

  return (
    <AppMain>
      <AppPageHeader title="Project exports" description={`${project.name} · Role: ${membership.role}`} />
      <ProjectOperationsNav projectId={project.id} current="exports" role={membership.role} />
      <AppSection>
        <ProjectExportPanel projectId={project.id} />
      </AppSection>
    </AppMain>
  );
}
