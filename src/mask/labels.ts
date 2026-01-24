export type LabelId = number;

export const Labels = {
  BG: 0,
  SAPWOOD: 1,
  HEARTWOOD: 2,
  COPPER: 3,
} as const satisfies Record<string, LabelId>;

export type BuiltinLabelKey = keyof typeof Labels;

export type LabelDef = {
  id: LabelId;
  key: string;          // z.B. "SAPWOOD"
  name: string;         // z.B. "Sapwood"
  rgb: [number, number, number];
  alpha?: number;       // 0..1, optional (default über global opacity)
};

export const DEFAULT_LABELS: LabelDef[] = [
  { id: Labels.BG,       key: "BG",       name: "Background", rgb: [0, 0, 0], alpha: 0 }, // Overlay unsichtbar
  { id: Labels.SAPWOOD,  key: "SAPWOOD",  name: "Sapwood",    rgb: [255, 170, 0], alpha: 0.45 },
  { id: Labels.HEARTWOOD,key: "HEARTWOOD",name: "Heartwood",  rgb: [255, 70, 70], alpha: 0.45 },
  { id: Labels.COPPER,   key: "COPPER",   name: "Copper",     rgb: [40, 120, 255], alpha: 0.55 },
];
