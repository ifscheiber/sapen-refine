import { ImageCropBBoxesPage } from "@/features/editor/ImageCropBBoxesPage";

export default async function Page(
  props: { params: Promise<{ projectId: string; imageId: string }> },
) {
  const { projectId, imageId } = await props.params;
  return <ImageCropBBoxesPage projectId={projectId} imageId={imageId} />;
}
