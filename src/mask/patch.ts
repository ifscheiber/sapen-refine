import type { LabelId } from "./labels";
import type { MaskBuffer } from "./maskBuffer";

export type Patch = {
  x: number;
  y: number;
  w: number;
  h: number;
  before: Uint8Array; // vorheriger Zustand in bbox
  after: Uint8Array;  // nachheriger Zustand in bbox
};

export function applyPatch(mask: MaskBuffer, patch: Patch, direction: "before" | "after") {
  const src = direction === "before" ? patch.before : patch.after;
  let k = 0;
  for (let yy = 0; yy < patch.h; yy++) {
    for (let xx = 0; xx < patch.w; xx++) {
      const x = patch.x + xx;
      const y = patch.y + yy;
      if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) { k++; continue; }
      mask.data[y * mask.width + x] = src[k++] as LabelId;
    }
  }
}
