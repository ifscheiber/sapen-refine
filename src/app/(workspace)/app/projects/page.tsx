import { ProjectsWorkspacePage } from "@/features/projects/ProjectsWorkspacePage";

export default async function ProjectsPage(props: {
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  return <ProjectsWorkspacePage tab={searchParams?.tab} />;
}
