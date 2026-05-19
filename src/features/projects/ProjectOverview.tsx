import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { AppSection } from "@/components/shell/AppSection";
import { requireUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db";

export async function ProjectOverview({ projectId }: { projectId: string }) {
  const user = await requireUser();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { where: { userId: user.id }, take: 1, select: { role: true } },
    },
  });

  if (!project || project.members.length === 0) return notFound();

  return (
    <AppMain>
      <AppPageHeader
        title={project.name}
        description={`Role: ${project.members[0].role}`}
        actions={
          <Button asChild>
            <Link href={`/app/projects/${project.id}/images`}>Images</Link>
          </Button>
        }
      />
      <AppSection>
        <p className="text-sm text-muted-foreground">
          Image upload, annotation metadata, review, and export workflows will build from this project workspace.
        </p>
      </AppSection>
    </AppMain>
  );
}
