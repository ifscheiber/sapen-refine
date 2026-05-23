import { CropSemanticEditorPage } from "@/features/editor/CropSemanticEditorPage";

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
    <CropSemanticEditorPage
      projectId={projectId}
      imageId={imageId}
      sliceInstanceId={sliceInstanceId}
      cropId={cropId}
    />
  );
}
