import Link from "next/link";
import { notFound } from "next/navigation";
import { ListTodo } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { requireUser } from "@/server/auth/rbac";
import { loadCorrectionContextForUser } from "@/server/domain/assistedCorrection";
import EditorClient from "./EditorClient";

export async function CorrectionTaskEditorPage({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const user = await requireUser();
  const context = await loadCorrectionContextForUser({ taskId, userId: user.id }).catch(() => null);
  if (!context || context.task.projectId !== projectId || !context.image?.id) return notFound();

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
