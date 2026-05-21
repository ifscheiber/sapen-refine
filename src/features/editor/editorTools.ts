import { Labels, type LabelId } from "@/mask/labels";

import type { MaskMode, Tool } from "./editorTypes";

export function isBrushLikeTool(tool: Tool): tool is "brush" | "eraser" {
  return tool === "brush" || tool === "eraser";
}

export function getEraseLabelForMaskMode(maskMode: MaskMode, supportBackgroundLabel: LabelId = Labels.BG): LabelId {
  return maskMode === "support" ? supportBackgroundLabel : Labels.BG;
}

export function getPaintLabelForTool(params: {
  tool: Tool;
  maskMode: MaskMode;
  activeLabel: LabelId;
  supportBackgroundLabel?: LabelId;
}) {
  if (params.tool !== "eraser") return params.activeLabel;
  return getEraseLabelForMaskMode(params.maskMode, params.supportBackgroundLabel);
}

export function formatEraserHint(maskMode: MaskMode) {
  return maskMode === "support" ? "Eraser: support background" : "Eraser: semantic background";
}
