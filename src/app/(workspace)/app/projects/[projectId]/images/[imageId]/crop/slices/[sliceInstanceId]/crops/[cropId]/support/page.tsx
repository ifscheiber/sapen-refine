import { CropSupportEditorPage } from "@/features/editor/CropSupportEditorPage";

export default async function Page({
  params,
}: {
  params: Promise<{
    projectId: string;
    imageId: string;
    sliceInstanceId: string;
    cropId: string;
  }>;
}) {
  const { projectId, imageId, sliceInstanceId, cropId } = await params;
  return (
    <CropSupportEditorPage
      projectId={projectId}
      imageId={imageId}
      sliceInstanceId={sliceInstanceId}
      cropId={cropId}
    />
  );
}
