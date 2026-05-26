import { ImageCropSlicesPage } from "@/features/editor/ImageCropSlicesPage";

export default async function Page(
  props: { params: Promise<{ projectId: string; imageId: string }> },
) {
  const { projectId, imageId } = await props.params;
  return <ImageCropSlicesPage projectId={projectId} imageId={imageId} />;
}
