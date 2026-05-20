import { CorrectionTaskEditorPage } from "@/features/editor/CorrectionTaskEditorPage";

export default async function CorrectTaskPage(
  props: { params: Promise<{ projectId: string; taskId: string }> },
) {
  const { projectId, taskId } = await props.params;
  return <CorrectionTaskEditorPage projectId={projectId} taskId={taskId} />;
}
