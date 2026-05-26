import { ProjectExportsPage } from "@/features/projects/ProjectExportsPage";

export default async function ExportsPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  return <ProjectExportsPage projectId={projectId} />;
}

