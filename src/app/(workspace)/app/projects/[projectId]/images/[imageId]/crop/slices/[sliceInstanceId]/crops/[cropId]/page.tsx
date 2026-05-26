import { CropSemanticEditorPage } from "@/features/editor/CropSemanticEditorPage";
import type { CropSemanticMode } from "@/features/editor/editorTypes";

function parseInitialSemanticMode(value: string | string[] | undefined): CropSemanticMode | undefined {
  const mode = Array.isArray(value) ? value[0] : value;
  if (mode === "SAP_HEARTWOOD" || mode === "COPPER") return mode;
  return undefined;
}

function parseInitialTarget(value: string | string[] | undefined): "semantic" | "support" | undefined {
  const target = Array.isArray(value) ? value[0] : value;
  if (target === "semantic" || target === "support") return target;
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
  searchParams: Promise<{ mode?: string | string[]; target?: string | string[] }>;
}) {
  const { projectId, imageId, sliceInstanceId, cropId } = await params;
  const { mode, target } = await searchParams;
  return (
    <CropSemanticEditorPage
      projectId={projectId}
      imageId={imageId}
      sliceInstanceId={sliceInstanceId}
      cropId={cropId}
      initialSemanticMode={parseInitialSemanticMode(mode)}
      initialTarget={parseInitialTarget(target)}
    />
  );
}
