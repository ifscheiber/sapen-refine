import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { AppSection } from "@/components/shell/AppSection";
import { requireUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ProjectExportPanel } from "./ProjectExportPanel";
import { ProjectMetadataForm } from "./ProjectMetadataForm";

export async function ProjectOverview({ projectId }: { projectId: string }) {
  const user = await requireUser();

  const project = await prisma.annotationProject.findUnique({
    where: { id: projectId },
    include: {
      members: { where: { userId: user.id }, take: 1, select: { role: true } },
      labelSchemaVersion: { select: { name: true, version: true, status: true } },
    },
  });

  if (!project || project.members.length === 0) return notFound();

  const role = project.members[0].role;
  const canEdit = role === "OWNER" || role === "QA";

  return (
    <AppMain>
      <AppPageHeader
        title={project.name}
        description={`Role: ${role}`}
        actions={
          <Button asChild>
            <Link href={`/app/projects/${project.id}/images`}>Images</Link>
          </Button>
        }
      />
      <AppSection>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
          <ProjectMetadataForm
            projectId={project.id}
            initialName={project.name}
            initialDescription={project.description ?? ""}
            canEdit={canEdit}
          />

          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium">Active label schema</div>
              <div className="mt-1 text-muted-foreground">
                {project.labelSchemaVersion
                  ? `${project.labelSchemaVersion.name} ${project.labelSchemaVersion.version} (${project.labelSchemaVersion.status})`
                  : "Missing active label schema"}
              </div>
            </div>
            {!project.labelSchemaVersion && (
              <div className="rounded-md border border-destructive px-3 py-2 text-destructive">
                Attach the default label schema before export-oriented work.
              </div>
            )}
            <div>
              <div className="font-medium">Updated</div>
              <div className="mt-1 text-muted-foreground">{project.updatedAt.toLocaleString()}</div>
            </div>
            <div>
              <div className="font-medium">Created</div>
              <div className="mt-1 text-muted-foreground">{project.createdAt.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </AppSection>
      <AppSection>
        <ProjectExportPanel projectId={project.id} />
      </AppSection>
    </AppMain>
  );
}
