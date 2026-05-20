import { ProjectPredictionImportsPage } from "@/features/projects/ProjectPredictionImportsPage";

export default async function PredictionImportsPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  return <ProjectPredictionImportsPage projectId={projectId} />;
}

