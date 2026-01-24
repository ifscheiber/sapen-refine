import type { MaskBuffer } from "./maskBuffer";
import type { LabelId } from "./labels";

type LabelDef = {
  id: number;
  // unterstütze mehrere Varianten, damit du flexibel bist:
  rgba?: [number, number, number, number?];
  rgb?: [number, number, number];
  color?: string; // "#RRGGBB" oder "#RRGGBBAA"
};

function clamp255(n: number) {
  return Math.max(0, Math.min(255, n | 0));
}

function parseHexColor(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "").trim();
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return [r, g, b, 255];
  }
  if (h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = parseInt(h.slice(6, 8), 16);
    return [r, g, b, a];
  }
  // fallback
  return [255, 0, 255, 255];
}

function labelToRgba(label: LabelDef): [number, number, number, number] {
  if (label.rgba) {
    const [r, g, b, a = 255] = label.rgba;
    return [r, g, b, a];
  }
  if (label.rgb) {
    const [r, g, b] = label.rgb;
    return [r, g, b, 255];
  }
  if (label.color) return parseHexColor(label.color);
  return [255, 0, 255, 255]; // magenta fallback
}

export function buildPalette(labels: LabelDef[], opacity: number): Uint8ClampedArray {
  const maxId = labels.reduce((m, l) => Math.max(m, l.id), 0);
  const pal = new Uint8ClampedArray((maxId + 1) * 4);

  for (const l of labels) {
    const [r, g, b, a] = labelToRgba(l);
    const idx = l.id * 4;

    // BG (=0) transparent lassen (typisch)
    if (l.id === 0) {
      pal[idx + 0] = 0;
      pal[idx + 1] = 0;
      pal[idx + 2] = 0;
      pal[idx + 3] = 0;
      continue;
    }

    pal[idx + 0] = clamp255(r);
    pal[idx + 1] = clamp255(g);
    pal[idx + 2] = clamp255(b);
    pal[idx + 3] = clamp255(a * opacity);
  }

  return pal;
}

export function renderOverlay(mask: MaskBuffer, labels: LabelDef[], opacity: number): ImageData {
  const w = mask.width;
  const h = mask.height;
  const pal = buildPalette(labels, opacity);

  const out = new ImageData(w, h);
  const dst = out.data;
  const src = mask.data;

  for (let i = 0; i < src.length; i++) {
    const id = src[i] as number;
    const pi = id * 4;
    const di = i * 4;

    dst[di + 0] = pal[pi + 0] ?? 0;
    dst[di + 1] = pal[pi + 1] ?? 0;
    dst[di + 2] = pal[pi + 2] ?? 0;
    dst[di + 3] = pal[pi + 3] ?? 0;
  }

  return out;
}

/**
 * Update nur Region (x,y,w,h) anhand aktueller mask.data.
 * overlay wird IN PLACE verändert.
 */
export function updateOverlayRegion(
  overlay: ImageData,
  mask: MaskBuffer,
  labels: LabelDef[],
  opacity: number,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const pal = buildPalette(labels, opacity);
  updateOverlayRegionWithPalette(overlay, mask, pal, x, y, w, h);
}

export function updateOverlayRegionWithPalette(
  overlay: ImageData,
  mask: MaskBuffer,
  palette: Uint8ClampedArray,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const W = mask.width;
  const H = mask.height;

  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);

  const dst = overlay.data;
  const src = mask.data;

  for (let yy = y0; yy < y1; yy++) {
    let row = yy * W;
    for (let xx = x0; xx < x1; xx++) {
      const i = row + xx;
      const id = src[i] as number;

      const pi = id * 4;
      const di = i * 4;

      dst[di + 0] = palette[pi + 0] ?? 0;
      dst[di + 1] = palette[pi + 1] ?? 0;
      dst[di + 2] = palette[pi + 2] ?? 0;
      dst[di + 3] = palette[pi + 3] ?? 0;
    }
  }
}
