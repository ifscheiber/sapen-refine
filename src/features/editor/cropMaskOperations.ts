import type { LabelId } from "@/mask/labels";
import { MaskBuffer } from "@/mask/maskBuffer";
import type { Patch } from "@/mask/patch";
import { applyBrush, applyBrushWithinSupport, applyPolygonFill } from "@/mask/tools";

import type { Point } from "./editorTypes";

type CropMaskConstraint = {
  supportMask?: MaskBuffer | null;
  constrainToSupport?: boolean;
};

export type CropBrushOperation = CropMaskConstraint & {
  mask: MaskBuffer;
  x: number;
  y: number;
  radius: number;
  label: LabelId;
};

export type CropPolygonFillOperation = CropMaskConstraint & {
  mask: MaskBuffer;
  points: Point[];
  label: LabelId;
};

export type ForegroundOutsideSupportCheck = {
  semanticMask: MaskBuffer;
  supportMask: MaskBuffer;
  semanticBackgroundLabel: LabelId;
  supportBackgroundLabel: LabelId;
};

function captureBox(mask: MaskBuffer, x: number, y: number, width: number, height: number) {
  const out = new Uint8Array(width * height);
  let offset = 0;
  for (let yy = 0; yy < height; yy += 1) {
    const sourceOffset = (y + yy) * mask.width + x;
    for (let xx = 0; xx < width; xx += 1) {
      out[offset++] = mask.data[sourceOffset + xx];
    }
  }
  return out;
}

function assertMatchingDimensions(mask: MaskBuffer, supportMask: MaskBuffer) {
  if (mask.width !== supportMask.width || mask.height !== supportMask.height) {
    throw new Error("SUPPORT_MASK_DIMENSIONS_MISMATCH");
  }
}

export function findForegroundOutsideSupport({
  semanticMask,
  supportMask,
  semanticBackgroundLabel,
  supportBackgroundLabel,
}: ForegroundOutsideSupportCheck): { x: number; y: number } | null {
  assertMatchingDimensions(semanticMask, supportMask);

  for (let index = 0; index < semanticMask.data.byteLength; index += 1) {
    if (
      semanticMask.data[index] !== semanticBackgroundLabel &&
      supportMask.data[index] === supportBackgroundLabel
    ) {
      return {
        x: index % semanticMask.width,
        y: Math.floor(index / semanticMask.width),
      };
    }
  }

  return null;
}

export function applyCropBrush({
  mask,
  supportMask,
  constrainToSupport = false,
  x,
  y,
  radius,
  label,
}: CropBrushOperation): Patch | null {
  if (constrainToSupport && supportMask) {
    return applyBrushWithinSupport(mask, supportMask, x, y, radius, label);
  }

  return applyBrush(mask, x, y, radius, label);
}

export function applyCropPolygonFill({
  mask,
  supportMask,
  constrainToSupport = false,
  points,
  label,
}: CropPolygonFillOperation): Patch | null {
  if (!constrainToSupport || !supportMask) {
    return applyPolygonFill(mask, points, label);
  }

  assertMatchingDimensions(mask, supportMask);
  if (points.length < 3) return null;

  const candidate = new MaskBuffer(mask.width, mask.height, 0 as LabelId);
  const candidatePatch = applyPolygonFill(candidate, points, 1 as LabelId);
  if (!candidatePatch) return null;

  const { x, y, w, h } = candidatePatch;
  const before = captureBox(mask, x, y, w, h);
  let changed = false;

  for (let yy = 0; yy < h; yy += 1) {
    const py = y + yy;
    for (let xx = 0; xx < w; xx += 1) {
      const px = x + xx;
      const index = py * mask.width + px;
      if (candidate.data[index] === 0 || supportMask.data[index] === 0 || mask.data[index] === label) {
        continue;
      }
      mask.data[index] = label;
      changed = true;
    }
  }

  if (!changed) return null;

  return {
    x,
    y,
    w,
    h,
    before,
    after: captureBox(mask, x, y, w, h),
  };
}
