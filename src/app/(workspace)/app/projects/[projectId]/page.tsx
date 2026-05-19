import { ProjectOverview } from "@/features/projects/ProjectOverview";

export default async function ProjectPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  return <ProjectOverview projectId={projectId} />;
}
