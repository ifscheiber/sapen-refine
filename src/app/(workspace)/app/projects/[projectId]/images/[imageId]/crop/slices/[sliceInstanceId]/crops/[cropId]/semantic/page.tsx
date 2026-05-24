import { redirect } from "next/navigation";
import type { CropSemanticMode } from "@/features/editor/editorTypes";

function parseInitialSemanticMode(value: string | string[] | undefined): CropSemanticMode | undefined {
  const mode = Array.isArray(value) ? value[0] : value;
  if (mode === "SAP_HEARTWOOD" || mode === "COPPER") return mode;
  return undefined;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{
    projectId: string;
    imageId: string;
    sliceInstanceId: string;
    cropId: string;
  }>;
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const { projectId, imageId, sliceInstanceId, cropId } = await params;
  const { mode } = await searchParams;
  const initialMode = parseInitialSemanticMode(mode) ?? "SAP_HEARTWOOD";
  redirect(
    `/app/projects/${projectId}/images/${imageId}/crop/slices/${sliceInstanceId}/crops/${cropId}` +
      `?mode=${initialMode}&target=semantic`,
  );
}
