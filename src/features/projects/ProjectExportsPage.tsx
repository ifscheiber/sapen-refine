import { notFound } from "next/navigation";

import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { AppSection } from "@/components/shell/AppSection";
import { PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireProjectRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ProjectExportPanel } from "./ProjectExportPanel";
import { ProjectOperationsNav } from "./ProjectOperationsNav";

export async function ProjectExportsPage({ projectId }: { projectId: string }) {
  const { membership } = await requireProjectRole(projectId, PROJECT_READ_ROLES);

  const project = await prisma.annotationProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) return notFound();

  return (
    <AppMain>
      <AppPageHeader title="Project exports" description={`${project.name} · Role: ${membership.role}`} />
      <ProjectOperationsNav projectId={project.id} current="exports" />
      <AppSection>
        <ProjectExportPanel projectId={project.id} />
      </AppSection>
    </AppMain>
  );
}
