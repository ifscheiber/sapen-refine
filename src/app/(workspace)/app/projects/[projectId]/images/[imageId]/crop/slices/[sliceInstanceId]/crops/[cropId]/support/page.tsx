import { redirect } from "next/navigation";

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
  redirect(
    `/app/projects/${projectId}/images/${imageId}/crop/slices/${sliceInstanceId}/crops/${cropId}` +
      "?mode=COPPER&target=support",
  );
}
