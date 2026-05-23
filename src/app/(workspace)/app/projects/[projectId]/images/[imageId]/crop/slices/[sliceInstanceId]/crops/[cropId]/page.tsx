import { CropWorkbenchPage } from "@/features/editor/CropWorkbenchPage";

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
    <CropWorkbenchPage
      projectId={projectId}
      imageId={imageId}
      sliceInstanceId={sliceInstanceId}
      cropId={cropId}
    />
  );
}
