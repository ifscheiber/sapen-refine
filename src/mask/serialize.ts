import { MaskBuffer } from "./maskBuffer";

const MAGIC = 0x4d534b31; // "MSK1"

export function serializeMask(mask: MaskBuffer): ArrayBuffer {
  const headerSize = 12; // magic(4) + w(4) + h(4)
  const payload = mask.data; // Uint8Array length w*h
  const buf = new ArrayBuffer(headerSize + payload.byteLength);
  const dv = new DataView(buf);

  dv.setUint32(0, MAGIC, false);
  dv.setUint32(4, mask.width, false);
  dv.setUint32(8, mask.height, false);

  new Uint8Array(buf, headerSize).set(payload);
  return buf;
}

export function deserializeMask(buf: ArrayBuffer): { width: number; height: number; data: Uint8Array } {
  const dv = new DataView(buf);
  const magic = dv.getUint32(0, false);
  if (magic !== MAGIC) throw new Error("MASK_BAD_MAGIC");

  const width = dv.getUint32(4, false);
  const height = dv.getUint32(8, false);

  const headerSize = 12;
  const payload = new Uint8Array(buf, headerSize);

  if (payload.length !== width * height) {
    throw new Error("MASK_BAD_SIZE");
  }

  // copy to detach from underlying ArrayBuffer slice if you want
  return { width, height, data: new Uint8Array(payload) };
}
