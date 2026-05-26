import { ImageCropSlicesPage } from "@/features/editor/ImageCropSlicesPage";

export default async function Page(
  props: { params: Promise<{ projectId: string; imageId: string; sliceInstanceId: string }> },
) {
  const { projectId, imageId, sliceInstanceId } = await props.params;
  return (
    <ImageCropSlicesPage
      projectId={projectId}
      imageId={imageId}
      selectedSliceInstanceId={sliceInstanceId}
    />
  );
}
