import { redirect } from "next/navigation";

export default async function Page(
  props: {
    params: Promise<{
      projectId: string;
      imageId: string;
      sliceInstanceId: string;
      cropId: string;
    }>;
  },
) {
  const { projectId, imageId, sliceInstanceId, cropId } = await props.params;
  redirect(
    `/app/projects/${projectId}/images/${imageId}/crop/slices/${sliceInstanceId}/crops/${cropId}` +
      "?mode=COPPER&target=support",
  );
}
