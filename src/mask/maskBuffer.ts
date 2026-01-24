import type { LabelId } from "./labels";

export class MaskBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;

  constructor(width: number, height: number, fill: LabelId = 0, data?: Uint8Array) {
    this.width = width;
    this.height = height;
    this.data = data ?? new Uint8Array(width * height);
    if (!data) this.data.fill(fill);
    if (this.data.length !== width * height) {
      throw new Error("MaskBuffer: invalid data length");
    }
  }

  index(x: number, y: number) {
    return y * this.width + x;
  }

  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): LabelId {
    if (!this.inBounds(x, y)) return 0;
    return this.data[this.index(x, y)] as LabelId;
  }

  set(x: number, y: number, v: LabelId) {
    if (!this.inBounds(x, y)) return;
    this.data[this.index(x, y)] = v;
  }

  clone(): MaskBuffer {
    return new MaskBuffer(this.width, this.height, 0, this.data.slice());
  }
}
