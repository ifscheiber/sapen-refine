import Link from "next/link";
import { ListTodo } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppMain } from "@/components/shell/AppMain";
import { AppMissingResource } from "@/components/shell/AppMissingResource";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { loadCorrectionContextForUser } from "@/server/domain/assistedCorrection";
import EditorClient from "./EditorClient";

export async function CorrectionTaskEditorPage({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const { user } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);
  const context = await loadCorrectionContextForUser({ taskId, userId: user.id }).catch(() => null);
  if (!context || context.task.projectId !== projectId || !context.image?.id) {
    return (
      <AppMain>
        <AppPageHeader title="Correction task not found" description="SaPen Annotate" />
        <AppMissingResource
          title="Correction task not found or no longer available"
          description="The task may have been removed, completed elsewhere, or the copied link may be stale."
          actions={[
            { kind: "tasks", href: `/app/projects/${projectId}/tasks` },
            { kind: "project", href: `/app/projects/${projectId}` },
          ]}
        />
      </AppMain>
    );
  }

  const target = context.mode === "support" ? "Slice support correction" : "Semantic correction";
  const score = [
    context.task.taskReason,
    context.task.confidenceScore === null ? null : `confidence ${context.task.confidenceScore.toFixed(2)}`,
    context.task.uncertaintyScore === null ? null : `uncertainty ${context.task.uncertaintyScore.toFixed(2)}`,
  ].filter(Boolean).join(" · ");

  return (
    <AppMain className="max-w-none">
      <AppPageHeader
        title={`${target}: ${context.image.filename ?? context.image.id}`}
        description={score || context.task.status}
        actions={
          <Button asChild variant="outline">
            <Link href={`/app/projects/${projectId}/tasks`}>
              <ListTodo />
              Tasks
            </Link>
          </Button>
        }
      />
      <EditorClient
        projectId={projectId}
        imageId={context.image.id}
        canEdit={context.canEdit}
        correctionTaskId={taskId}
        correctionMode={context.mode}
      />
    </AppMain>
  );
}
