import {
  ArtifactReviewState,
  CropSemanticMode,
  SliceClass,
} from "@prisma/client";

const CROP_SEMANTIC_MODES = [
  CropSemanticMode.SAP_HEARTWOOD,
  CropSemanticMode.COPPER,
] as const;

export type CropSemanticFamilyStateValue =
  | "NONE"
  | "SAP_HEARTWOOD"
  | "COPPER"
  | "CONFLICT";

export type CropSemanticFamilyState = {
  state: CropSemanticFamilyStateValue;
  activeMode: CropSemanticMode | null;
  activeModes: CropSemanticMode[];
  conflictModes: CropSemanticMode[];
  blockedModes: CropSemanticMode[];
  resetRequiredModes: CropSemanticMode[];
};

type SemanticFamilyModeValue = CropSemanticMode | `${CropSemanticMode}` | null | undefined;

type SemanticFamilyVersion = {
  cropSemanticMode: SemanticFamilyModeValue;
  reviewState: ArtifactReviewState | string | null;
} | null | undefined;

function normalizeMode(value: SemanticFamilyModeValue) {
  if (value === CropSemanticMode.SAP_HEARTWOOD) return CropSemanticMode.SAP_HEARTWOOD;
  if (value === CropSemanticMode.COPPER) return CropSemanticMode.COPPER;
  return null;
}

export function buildCropSemanticFamilyState(
  versions: Iterable<SemanticFamilyVersion>,
): CropSemanticFamilyState {
  const activeModes = new Set<CropSemanticMode>();
  for (const version of versions) {
    const mode = normalizeMode(version?.cropSemanticMode);
    if (!mode || version?.reviewState === ArtifactReviewState.SUPERSEDED) continue;
    activeModes.add(mode);
  }

  const modes = CROP_SEMANTIC_MODES.filter((mode) => activeModes.has(mode));
  if (modes.length === 0) {
    return {
      state: "NONE",
      activeMode: null,
      activeModes: [],
      conflictModes: [],
      blockedModes: [],
      resetRequiredModes: [],
    };
  }

  if (modes.length === 1) {
    const activeMode = modes[0];
    const blockedModes = CROP_SEMANTIC_MODES.filter((mode) => mode !== activeMode);
    return {
      state: activeMode,
      activeMode,
      activeModes: [activeMode],
      conflictModes: [],
      blockedModes,
      resetRequiredModes: blockedModes,
    };
  }

  return {
    state: "CONFLICT",
    activeMode: null,
    activeModes: modes,
    conflictModes: modes,
    blockedModes: [...CROP_SEMANTIC_MODES],
    resetRequiredModes: [...CROP_SEMANTIC_MODES],
  };
}

export function cropSemanticFamilySaveGuard(
  family: CropSemanticFamilyState,
  requestedMode: CropSemanticMode,
) {
  if (family.state === "CONFLICT") {
    return {
      resetRequired: true,
      error: "SEMANTIC_FAMILY_CONFLICT",
    };
  }

  if (family.activeMode && family.activeMode !== requestedMode) {
    return {
      resetRequired: true,
      error: "SEMANTIC_FAMILY_RESET_REQUIRED",
    };
  }

  return {
    resetRequired: false,
    error: null,
  };
}

export function classConflictsWithSemanticFamily(
  sliceClass: SliceClass | `${SliceClass}` | string | null | undefined,
  activeMode: CropSemanticMode | `${CropSemanticMode}` | null | undefined,
) {
  if (activeMode === CropSemanticMode.SAP_HEARTWOOD) {
    return sliceClass === SliceClass.COPPER_SLICE;
  }
  if (activeMode === CropSemanticMode.COPPER) {
    return sliceClass === SliceClass.SAP_HEARTWOOD_SLICE;
  }
  return false;
}
