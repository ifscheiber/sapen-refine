import { notFound } from "next/navigation";

import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { AppSection } from "@/components/shell/AppSection";
import { requireWorkspaceUser } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import { ProjectCorrectionTaskQueue } from "./ProjectCorrectionTaskQueue";
import { ProjectOperationsNav } from "./ProjectOperationsNav";

export async function ProjectCorrectionTasksPage({ projectId }: { projectId: string }) {
  const user = await requireWorkspaceUser();
  const project = await prisma.annotationProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      members: { where: { userId: user.id }, select: { role: true }, take: 1 },
    },
  });

  if (!project || project.members.length === 0) return notFound();
  const role = project.members[0].role;

  return (
    <AppMain>
      <AppPageHeader
        title="Correction tasks"
        description={`${project.name} · Role: ${role}`}
      />
      <ProjectOperationsNav projectId={project.id} current="tasks" />
      <AppSection>
        <ProjectCorrectionTaskQueue projectId={project.id} role={role} />
      </AppSection>
    </AppMain>
  );
}
