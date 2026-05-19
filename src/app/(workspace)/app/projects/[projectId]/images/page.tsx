import { ProjectImagesPage } from "@/features/images/ProjectImagesPage";

export default async function ImagesPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  return <ProjectImagesPage projectId={projectId} />;
}
