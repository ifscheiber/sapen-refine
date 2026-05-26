import { ImageCropWorkflowEntryPage } from "@/features/editor/ImageCropWorkflowEntryPage";

export default async function Page(
  props: { params: Promise<{ projectId: string; imageId: string }> },
) {
  const { projectId, imageId } = await props.params;
  return <ImageCropWorkflowEntryPage projectId={projectId} imageId={imageId} />;
}
