import type { LabelId } from "./labels";
import { MaskBuffer } from "./maskBuffer";
import type { Patch } from "./patch";

type Point = { x: number; y: number };

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function captureBox(mask: MaskBuffer, x: number, y: number, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  let k = 0;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const px = x + xx;
      const py = y + yy;
      out[k++] = (px < 0 || py < 0 || px >= mask.width || py >= mask.height)
        ? 0
        : mask.data[py * mask.width + px];
    }
  }
  return out;
}

export function applyBrush(mask: MaskBuffer, cx: number, cy: number, radius: number, label: LabelId): Patch {
  const r = Math.max(1, Math.floor(radius));
  const x0 = clamp(cx - r, 0, mask.width - 1);
  const y0 = clamp(cy - r, 0, mask.height - 1);
  const x1 = clamp(cx + r, 0, mask.width - 1);
  const y1 = clamp(cy + r, 0, mask.height - 1);

  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;

  const before = captureBox(mask, x0, y0, w, h);

  const rr = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rr) {
        mask.data[y * mask.width + x] = label;
      }
    }
  }

  const after = captureBox(mask, x0, y0, w, h);
  return { x: x0, y: y0, w, h, before, after };
}

export function applyPolygonFill(mask: MaskBuffer, points: Point[], label: LabelId): Patch | null {
  if (points.length < 3) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const x0 = clamp(Math.floor(minX), 0, mask.width - 1);
  const y0 = clamp(Math.floor(minY), 0, mask.height - 1);
  const x1 = clamp(Math.ceil(maxX), 0, mask.width - 1);
  const y1 = clamp(Math.ceil(maxY), 0, mask.height - 1);

  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w <= 0 || h <= 0) return null;

  const before = captureBox(mask, x0, y0, w, h);

  const n = points.length;
  for (let y = y0; y <= y1; y++) {
    const scanY = y + 0.5;
    const intersections: number[] = [];

    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const y1p = p1.y;
      const y2p = p2.y;
      const minYp = Math.min(y1p, y2p);
      const maxYp = Math.max(y1p, y2p);
      if (scanY < minYp || scanY >= maxYp) continue;
      if (y1p === y2p) continue;

      const t = (scanY - y1p) / (y2p - y1p);
      const x = p1.x + t * (p2.x - p1.x);
      intersections.push(x);
    }

    if (intersections.length < 2) continue;
    intersections.sort((a, b) => a - b);

    for (let i = 0; i < intersections.length - 1; i += 2) {
      const xStart = Math.max(x0, Math.ceil(intersections[i]));
      const xEnd = Math.min(x1, Math.floor(intersections[i + 1]));
      for (let x = xStart; x <= xEnd; x++) {
        mask.data[y * mask.width + x] = label;
      }
    }
  }

  const after = captureBox(mask, x0, y0, w, h);
  return { x: x0, y: y0, w, h, before, after };
}
