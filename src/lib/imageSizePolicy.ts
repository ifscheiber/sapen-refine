export const TRIAL_NORMAL_EDITABLE_MAX_LONG_EDGE = 6000;
export const TRIAL_NORMAL_EDITABLE_MAX_SHORT_EDGE = 4000;
export const TRIAL_NORMAL_EDITABLE_MAX_PIXELS =
  TRIAL_NORMAL_EDITABLE_MAX_LONG_EDGE * TRIAL_NORMAL_EDITABLE_MAX_SHORT_EDGE;

export const TRIAL_MAX_EDITABLE_LONG_EDGE = 8000;
export const TRIAL_MAX_EDITABLE_SHORT_EDGE = 6000;
export const TRIAL_MAX_EDITABLE_PIXELS =
  TRIAL_MAX_EDITABLE_LONG_EDGE * TRIAL_MAX_EDITABLE_SHORT_EDGE;

export type TrialImageEditability = "unknown" | "normal" | "large" | "unsupported";

export function evaluateTrialImageEditability(width?: number | null, height?: number | null): {
  status: TrialImageEditability;
  pixels: number | null;
  longEdge: number | null;
  shortEdge: number | null;
} {
  if (!Number.isInteger(width) || !Number.isInteger(height) || !width || !height || width <= 0 || height <= 0) {
    return { status: "unknown", pixels: null, longEdge: null, shortEdge: null };
  }

  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  const pixels = width * height;

  if (
    pixels > TRIAL_MAX_EDITABLE_PIXELS ||
    longEdge > TRIAL_MAX_EDITABLE_LONG_EDGE ||
    shortEdge > TRIAL_MAX_EDITABLE_SHORT_EDGE
  ) {
    return { status: "unsupported", pixels, longEdge, shortEdge };
  }

  if (
    pixels > TRIAL_NORMAL_EDITABLE_MAX_PIXELS ||
    longEdge > TRIAL_NORMAL_EDITABLE_MAX_LONG_EDGE ||
    shortEdge > TRIAL_NORMAL_EDITABLE_MAX_SHORT_EDGE
  ) {
    return { status: "large", pixels, longEdge, shortEdge };
  }

  return { status: "normal", pixels, longEdge, shortEdge };
}
