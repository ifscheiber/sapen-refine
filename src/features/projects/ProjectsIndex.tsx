import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AppEmptyState } from "@/components/shell/AppEmptyState";
import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { AppSection } from "@/components/shell/AppSection";
import { requireWorkspaceUser } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";

export async function ProjectsIndex() {
  const user = await requireWorkspaceUser();

  const projects = await prisma.annotationProject.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      members: { where: { userId: user.id }, select: { role: true }, take: 1 },
    },
  });

  return (
    <AppMain>
      <AppPageHeader
        title="Projects"
        description="Annotation workspaces for wood-slice image sets."
        actions={
          <Button asChild>
            <Link href="/app/projects/new">New project</Link>
          </Button>
        }
      />

      <div className="grid gap-3">
        {projects.map((project) => (
          <Link key={project.id} href={`/app/projects/${project.id}`}>
            <AppSection className="transition-colors hover:bg-accent hover:text-accent-foreground">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{project.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Updated {project.updatedAt.toLocaleDateString()}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{project.members[0]?.role}</div>
              </div>
            </AppSection>
          </Link>
        ))}
        {projects.length === 0 && (
          <AppEmptyState
            title="No projects yet"
            description="Create the first annotation project to start uploading images."
            action={
              <Button asChild>
                <Link href="/app/projects/new">New project</Link>
              </Button>
            }
          />
        )}
      </div>
    </AppMain>
  );
}
