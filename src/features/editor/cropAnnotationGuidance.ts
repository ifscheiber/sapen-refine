import { Labels, type LabelId } from "@/mask/labels";
import type { CropSemanticMode } from "./editorTypes";

export function cropSemanticModeLabel(mode: CropSemanticMode) {
  return mode === "COPPER" ? "Copper" : "Sap/Heartwood";
}

export function defaultLabelForSemanticMode(mode: CropSemanticMode): LabelId {
  return mode === "COPPER" ? Labels.COPPER : Labels.SAPWOOD;
}
