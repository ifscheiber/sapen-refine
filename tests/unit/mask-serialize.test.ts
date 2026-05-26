import { describe, expect, it } from "vitest";

import { Labels } from "@/mask/labels";
import { MaskBuffer } from "@/mask/maskBuffer";
import { deserializeMask, serializeMask } from "@/mask/serialize";

describe("mask serialization", () => {
  it("round-trips mask dimensions and label bytes", () => {
    const mask = new MaskBuffer(3, 2, Labels.BG);

    mask.set(0, 0, Labels.SAPWOOD);
    mask.set(1, 0, Labels.HEARTWOOD);
    mask.set(2, 1, Labels.COPPER);

    const parsed = deserializeMask(serializeMask(mask));

    expect(parsed.width).toBe(3);
    expect(parsed.height).toBe(2);
    expect(Array.from(parsed.data)).toEqual([
      Labels.SAPWOOD,
      Labels.HEARTWOOD,
      Labels.BG,
      Labels.BG,
      Labels.BG,
      Labels.COPPER,
    ]);
  });

  it("rejects buffers without the MSK1 magic header", () => {
    const invalid = new ArrayBuffer(12);

    expect(() => deserializeMask(invalid)).toThrow("MASK_BAD_MAGIC");
  });
});
