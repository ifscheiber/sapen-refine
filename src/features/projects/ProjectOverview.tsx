import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BarChart3,
  FileArchive,
  ImageIcon,
  ListTodo,
  UploadCloud,
} from "lucide-react";
import { AnnotationTaskStatus, PredictionImportBatchStatus } from "@prisma/client";

import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { AppSection } from "@/components/shell/AppSection";
import { requireUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { resolveProjectExportReadiness } from "@/server/domain/exports";
import { ProjectMetadataForm } from "./ProjectMetadataForm";
import { ProjectOperationsNav } from "./ProjectOperationsNav";

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function OperationLink({
  href,
  icon: Icon,
  title,
  description,
  metric,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  metric: string;
}) {
  return (
    <Link
      href={href}
      className="grid min-h-32 gap-3 rounded-md border border-border bg-background p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          <Icon className="size-4 shrink-0" />
          <span>{title}</span>
        </div>
        <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{metric}</span>
      </div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </Link>
  );
}

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
  const [
    exportReadiness,
    activeTaskCount,
    predictionRunCount,
    totalBatchCount,
    openBatchCount,
    exportBatchCount,
  ] = await Promise.all([
    resolveProjectExportReadiness({ projectId: project.id, userId: user.id }),
    prisma.annotationTask.count({
      where: {
        projectId: project.id,
        status: {
          in: [
            AnnotationTaskStatus.OPEN,
            AnnotationTaskStatus.IN_PROGRESS,
            AnnotationTaskStatus.SUBMITTED,
            AnnotationTaskStatus.BLOCKED,
          ],
        },
      },
    }),
    prisma.predictionRun.count({ where: { projectId: project.id } }),
    prisma.predictionImportBatchJob.count({ where: { projectId: project.id } }),
    prisma.predictionImportBatchJob.count({
      where: {
        projectId: project.id,
        status: {
          in: [PredictionImportBatchStatus.PENDING, PredictionImportBatchStatus.PROCESSING],
        },
      },
    }),
    prisma.exportBatch.count({ where: { projectId: project.id } }),
  ]);

  return (
    <AppMain>
      <AppPageHeader
        title={project.name}
        description={`Role: ${role}`}
      />
      <ProjectOperationsNav projectId={project.id} current="overview" />
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
        <div className="grid gap-4">
          <div>
            <h2 className="text-base font-semibold">Project status</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Current readiness and operations summary. Detailed export and prediction import workflows have their own pages.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryMetric label="Images" value={exportReadiness.summary.totalImages} />
            <SummaryMetric label="Semantic approved" value={exportReadiness.summary.approvedSemanticMasks} />
            <SummaryMetric label="Support approved" value={exportReadiness.summary.approvedSupportMasks} />
            <SummaryMetric label="Classifications approved" value={exportReadiness.summary.approvedClassifications} />
            <SummaryMetric label="Images with warnings" value={exportReadiness.summary.imagesWithWarnings} />
            <SummaryMetric label="Active tasks" value={activeTaskCount} />
            <SummaryMetric label="Prediction runs" value={predictionRunCount} />
            <SummaryMetric label="Export batches" value={exportBatchCount} />
          </div>
        </div>
      </AppSection>
      <AppSection>
        <div className="grid gap-4">
          <div>
            <h2 className="text-base font-semibold">Primary actions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use dedicated pages for repeated operations and larger forms.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <OperationLink
              href={`/app/projects/${project.id}/images`}
              icon={ImageIcon}
              title="Images"
              description="Upload images, review metadata readiness, and open the annotation editor."
              metric={`${exportReadiness.summary.totalImages} images`}
            />
            <OperationLink
              href={`/app/projects/${project.id}/tasks`}
              icon={ListTodo}
              title="Correction tasks"
              description="Review active-learning tasks and open assisted correction workflows."
              metric={`${activeTaskCount} active`}
            />
            <OperationLink
              href={`/app/projects/${project.id}/exports`}
              icon={FileArchive}
              title="Exports"
              description="Create ground-truth training exports and prediction-analysis packages."
              metric={`${exportBatchCount} batches`}
            />
            <OperationLink
              href={`/app/projects/${project.id}/prediction-imports`}
              icon={UploadCloud}
              title="Prediction imports"
              description="Manage prediction runs and ZIP-backed batch import operations."
              metric={canEdit ? `${openBatchCount}/${totalBatchCount} open` : "Owner/QA"}
            />
          </div>
        </div>
      </AppSection>
      <AppSection>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Operations model</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Training exports use approved human ground truth. Prediction-analysis exports and prediction imports remain proposal/QA workflows.
            </p>
          </div>
          <BarChart3 className="hidden size-5 text-muted-foreground md:block" />
        </div>
      </AppSection>
    </AppMain>
  );
}
