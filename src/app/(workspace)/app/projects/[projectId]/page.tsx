import { ProjectsWorkspacePage } from "@/features/projects/ProjectsWorkspacePage";

export default async function ProjectPage(props: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const { projectId } = await props.params;
  const searchParams = await props.searchParams;
  return <ProjectsWorkspacePage projectId={projectId} tab={searchParams?.tab} />;
}
