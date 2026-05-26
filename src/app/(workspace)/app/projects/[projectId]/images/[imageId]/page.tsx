import { ImageMetadataPage } from "@/features/images/ImageMetadataPage";

export default async function Page(
  props: { params: Promise<{ projectId: string; imageId: string }> }
) {
  const { projectId, imageId } = await props.params;
  return <ImageMetadataPage projectId={projectId} imageId={imageId} />;
}
