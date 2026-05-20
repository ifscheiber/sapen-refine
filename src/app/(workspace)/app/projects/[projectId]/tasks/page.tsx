import { ProjectCorrectionTasksPage } from "@/features/projects/ProjectCorrectionTasksPage";

export default async function TasksPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  return <ProjectCorrectionTasksPage projectId={projectId} />;
}
