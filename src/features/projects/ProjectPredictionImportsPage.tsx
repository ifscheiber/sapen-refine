import { notFound } from "next/navigation";

import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { AppSection } from "@/components/shell/AppSection";
import { canImportPrediction, PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import { ProjectOperationsNav } from "./ProjectOperationsNav";
import { ProjectPredictionImportBatchPanel } from "./ProjectPredictionImportBatchPanel";

export async function ProjectPredictionImportsPage({ projectId }: { projectId: string }) {
  const { membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

  const project = await prisma.annotationProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) return notFound();

  const canManage = canImportPrediction(membership.role);

  return (
    <AppMain>
      <AppPageHeader title="Prediction imports" description={`${project.name} · Role: ${membership.role}`} />
      <ProjectOperationsNav projectId={project.id} current="prediction-imports" />
      <AppSection>
        {canManage ? (
          <ProjectPredictionImportBatchPanel projectId={project.id} canManage={canManage} />
        ) : (
          <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
            Prediction import operations require project owner or QA access.
          </div>
        )}
      </AppSection>
    </AppMain>
  );
}
