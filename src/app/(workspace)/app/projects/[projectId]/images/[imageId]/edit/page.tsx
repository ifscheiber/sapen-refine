import { EditImagePage } from "@/features/editor/EditImagePage";

export default async function Page(
  props: { params: Promise<{ projectId: string; imageId: string }> }
) {
  const { projectId, imageId } = await props.params;
  return <EditImagePage projectId={projectId} imageId={imageId} />;
}
