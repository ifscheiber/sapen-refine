import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageIcon, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { AppSection } from "@/components/shell/AppSection";
import { requireUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ProjectCorrectionTaskQueue } from "./ProjectCorrectionTaskQueue";

export async function ProjectCorrectionTasksPage({ projectId }: { projectId: string }) {
  const user = await requireUser();
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
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/app/projects/${project.id}`}>
                <Settings />
                Project
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/app/projects/${project.id}/images`}>
                <ImageIcon />
                Images
              </Link>
            </Button>
          </>
        }
      />
      <AppSection>
        <ProjectCorrectionTaskQueue projectId={project.id} role={role} />
      </AppSection>
    </AppMain>
  );
}
