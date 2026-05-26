import {
  AnnotationArtifactKind,
  ArtifactReviewState,
  CropSemanticMode,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import {
  cropMaskStatsFromMetadata,
  histogramCount,
} from "@/server/domain/maskStats";

type CropAnnotationFamilyDb = PrismaClient | Prisma.TransactionClient;

const SEMANTIC_LABEL_STABLE_IDS = ["background", "sapwood", "heartwood", "copper"] as const;

const CROP_SEMANTIC_MASK_SCOPE_PREFIX = "crop-semantic:";
const CROP_SUPPORT_MASK_SCOPE_PREFIX = "crop-support:";

export const CROP_ANNOTATION_FAMILY_CONFLICT = "CROP_ANNOTATION_FAMILY_CONFLICT";

export type CropAnnotationFamily = "SAP_HEARTWOOD" | "CU_SUPPORT";
export type CropAnnotationFamilyStateValue = "EMPTY" | CropAnnotationFamily | "CONFLICT";

export type CropAnnotationFamilyState = {
  state: CropAnnotationFamilyStateValue;
  activeFamily: CropAnnotationFamily | null;
  occupiedFamilies: CropAnnotationFamily[];
  conflictFamilies: CropAnnotationFamily[];
  blockedFamilies: CropAnnotationFamily[];
  families: {
    sapHeartwood: {
      occupied: boolean;
      semanticMaskVersionId: string | null;
      hasSapwood: boolean;
      hasHeartwood: boolean;
    };
    cuSupport: {
      occupied: boolean;
      copperMaskVersionId: string | null;
      supportMaskVersionId: string | null;
      hasCopper: boolean;
      hasSupport: boolean;
    };
  };
};

export class CropAnnotationFamilyWorkflowError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

type CropForFamily = {
  id: string;
  projectId: string;
  sourceImageId: string;
  sliceInstanceId: string;
};

type FamilyLabelValues = {
  background: number;
  sapwood: number;
  heartwood: number;
  copper: number;
  sliceSupport: number;
};

type FamilyArtifactVersion = {
  id: string;
  version: number;
  storageKey: string;
  reviewState: ArtifactReviewState;
  size: number;
  checksum: string | null;
  width: number;
  height: number;
  metadataJson: Prisma.JsonValue | null;
};

export function cropAnnotationFamilyLockKey(cropId: string) {
  return `crop-annotation-family:${cropId}`;
}

function cropSemanticMaskScopeKey(cropId: string, semanticMode: CropSemanticMode) {
  return `${CROP_SEMANTIC_MASK_SCOPE_PREFIX}${cropId}:${semanticMode}`;
}

function cropSupportMaskScopeKey(cropId: string) {
  return `${CROP_SUPPORT_MASK_SCOPE_PREFIX}${cropId}`;
}

async function labelSchemaVersionIdForProject(db: CropAnnotationFamilyDb, projectId: string) {
  const project = await db.annotationProject.findUnique({
    where: { id: projectId },
    select: { labelSchemaVersionId: true },
  });
  if (project?.labelSchemaVersionId) return project.labelSchemaVersionId;

  const fallback = await db.labelSchemaVersion.findFirst({
    where: { isDefault: true, status: "ACTIVE" },
    select: { id: true },
  });
  if (!fallback) throw new CropAnnotationFamilyWorkflowError("DEFAULT_LABEL_SCHEMA_MISSING");
  return fallback.id;
}

export async function familyLabelValuesForProject(db: CropAnnotationFamilyDb, projectId: string): Promise<FamilyLabelValues> {
  const schemaVersionId = await labelSchemaVersionIdForProject(db, projectId);
  const labels = await db.labelDefinition.findMany({
    where: {
      schemaVersionId,
      stableId: { in: [...SEMANTIC_LABEL_STABLE_IDS, "slice_support"] },
    },
    select: { stableId: true, byteValue: true, applicability: true },
  });
  const byStableId = new Map(labels.map((label) => [label.stableId, label]));

  function semanticValue(stableId: (typeof SEMANTIC_LABEL_STABLE_IDS)[number]) {
    const label = byStableId.get(stableId);
    if (!label || label.applicability !== "SEMANTIC_MASK" || label.byteValue === null) {
      throw new CropAnnotationFamilyWorkflowError("SEMANTIC_LABELS_MISSING");
    }
    return label.byteValue;
  }

  const support = byStableId.get("slice_support");
  if (!support || support.applicability !== "SUPPORT_MASK" || support.byteValue === null) {
    throw new CropAnnotationFamilyWorkflowError("SLICE_SUPPORT_LABEL_MISSING");
  }

  return {
    background: semanticValue("background"),
    sapwood: semanticValue("sapwood"),
    heartwood: semanticValue("heartwood"),
    copper: semanticValue("copper"),
    sliceSupport: support.byteValue,
  };
}

async function latestArtifactVersion(params: {
  db: CropAnnotationFamilyDb;
  crop: CropForFamily;
  kind: AnnotationArtifactKind;
  scopeKey: string;
  semanticMode?: CropSemanticMode;
}) {
  const artifact = await params.db.annotationArtifact.findUnique({
    where: {
      imageId_kind_scopeKey: {
        imageId: params.crop.sourceImageId,
        kind: params.kind,
        scopeKey: params.scopeKey,
      },
    },
    select: { id: true },
  });
  if (!artifact) return null;

  return params.db.annotationArtifactVersion.findFirst({
    where: {
      artifactId: artifact.id,
      derivedCropId: params.crop.id,
      sliceInstanceId: params.crop.sliceInstanceId,
      reviewState: { not: ArtifactReviewState.SUPERSEDED },
      ...(params.semanticMode ? { cropSemanticMode: params.semanticMode } : {}),
    },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      storageKey: true,
      reviewState: true,
      size: true,
      checksum: true,
      width: true,
      height: true,
      metadataJson: true,
    },
  });
}

function hasAnyByte(bytes: Uint8Array, values: ReadonlySet<number>) {
  for (const value of bytes) {
    if (values.has(value)) return true;
  }
  return false;
}

function hasSupportBytes(bytes: Uint8Array, supportValue: number) {
  for (const value of bytes) {
    if (value === supportValue) return true;
  }
  return false;
}

async function readVersionBytes(version: FamilyArtifactVersion | null) {
  if (!version) return null;
  const { getObjectBytes } = await import("@/server/storage/s3");
  return getObjectBytes(version.storageKey);
}

export function semanticBytesOccupyAnnotationFamily(params: {
  semanticMode: CropSemanticMode;
  semanticBytes: Uint8Array;
  labels: FamilyLabelValues;
}) {
  if (params.semanticMode === CropSemanticMode.SAP_HEARTWOOD) {
    return hasAnyByte(params.semanticBytes, new Set([params.labels.sapwood, params.labels.heartwood]));
  }
  return hasAnyByte(params.semanticBytes, new Set([params.labels.copper]));
}

export function supportBytesOccupyAnnotationFamily(params: {
  supportBytes: Uint8Array;
  labels: Pick<FamilyLabelValues, "sliceSupport">;
}) {
  return hasSupportBytes(params.supportBytes, params.labels.sliceSupport);
}

function semanticVersionStatsOccupancy(params: {
  semanticMode: CropSemanticMode;
  version: FamilyArtifactVersion;
  labels: FamilyLabelValues;
}) {
  const stats = cropMaskStatsFromMetadata(params.version.metadataJson, {
    kind: "crop-semantic-mask",
    width: params.version.width,
    height: params.version.height,
    size: params.version.size,
    checksum: params.version.checksum,
  });
  if (!stats) return null;
  if (stats.semanticMode && stats.semanticMode !== params.semanticMode) return null;
  if (params.semanticMode === CropSemanticMode.SAP_HEARTWOOD) {
    return {
      hasSapwood: histogramCount(stats, params.labels.sapwood) > 0,
      hasHeartwood: histogramCount(stats, params.labels.heartwood) > 0,
      hasCopper: false,
    };
  }
  return {
    hasSapwood: false,
    hasHeartwood: false,
    hasCopper: histogramCount(stats, params.labels.copper) > 0,
  };
}

function supportVersionStatsOccupancy(params: {
  version: FamilyArtifactVersion;
  labels: Pick<FamilyLabelValues, "sliceSupport">;
}) {
  const stats = cropMaskStatsFromMetadata(params.version.metadataJson, {
    kind: "crop-support-mask",
    width: params.version.width,
    height: params.version.height,
    size: params.version.size,
    checksum: params.version.checksum,
  });
  return stats ? histogramCount(stats, params.labels.sliceSupport) > 0 : null;
}

async function semanticVersionOccupancy(params: {
  semanticMode: CropSemanticMode;
  version: FamilyArtifactVersion | null;
  labels: FamilyLabelValues;
}) {
  if (!params.version) return { hasSapwood: false, hasHeartwood: false, hasCopper: false };
  const statsOccupancy = semanticVersionStatsOccupancy({
    semanticMode: params.semanticMode,
    version: params.version,
    labels: params.labels,
  });
  if (statsOccupancy) return statsOccupancy;
  const bytes = await readVersionBytes(params.version);
  return {
    hasSapwood:
      params.semanticMode === CropSemanticMode.SAP_HEARTWOOD && bytes
        ? hasAnyByte(bytes, new Set([params.labels.sapwood]))
        : false,
    hasHeartwood:
      params.semanticMode === CropSemanticMode.SAP_HEARTWOOD && bytes
        ? hasAnyByte(bytes, new Set([params.labels.heartwood]))
        : false,
    hasCopper:
      params.semanticMode === CropSemanticMode.COPPER && bytes
        ? semanticBytesOccupyAnnotationFamily({
            semanticMode: CropSemanticMode.COPPER,
            semanticBytes: bytes,
            labels: params.labels,
          })
        : false,
  };
}

async function supportVersionOccupancy(params: {
  version: FamilyArtifactVersion | null;
  labels: Pick<FamilyLabelValues, "sliceSupport">;
}) {
  if (!params.version) return false;
  const statsOccupancy = supportVersionStatsOccupancy({
    version: params.version,
    labels: params.labels,
  });
  if (statsOccupancy !== null) return statsOccupancy;
  const bytes = await readVersionBytes(params.version);
  return bytes ? supportBytesOccupyAnnotationFamily({ supportBytes: bytes, labels: params.labels }) : false;
}

function buildState(params: {
  sapHeartwoodVersion: FamilyArtifactVersion | null;
  copperVersion: FamilyArtifactVersion | null;
  supportVersion: FamilyArtifactVersion | null;
  hasSapwood: boolean;
  hasHeartwood: boolean;
  hasCopper: boolean;
  hasSupport: boolean;
}): CropAnnotationFamilyState {
  const sapHeartwoodOccupied = params.hasSapwood || params.hasHeartwood;
  const cuSupportOccupied = params.hasCopper || params.hasSupport;
  const occupiedFamilies: CropAnnotationFamily[] = [
    ...(sapHeartwoodOccupied ? (["SAP_HEARTWOOD"] as const) : []),
    ...(cuSupportOccupied ? (["CU_SUPPORT"] as const) : []),
  ];
  const state: CropAnnotationFamilyStateValue =
    occupiedFamilies.length === 0 ? "EMPTY" : occupiedFamilies.length === 1 ? occupiedFamilies[0] : "CONFLICT";
  const activeFamily = state === "SAP_HEARTWOOD" || state === "CU_SUPPORT" ? state : null;
  const blockedFamilies =
    state === "SAP_HEARTWOOD"
      ? (["CU_SUPPORT"] as CropAnnotationFamily[])
      : state === "CU_SUPPORT"
        ? (["SAP_HEARTWOOD"] as CropAnnotationFamily[])
        : state === "CONFLICT"
          ? (["SAP_HEARTWOOD", "CU_SUPPORT"] as CropAnnotationFamily[])
          : [];

  return {
    state,
    activeFamily,
    occupiedFamilies,
    conflictFamilies: state === "CONFLICT" ? occupiedFamilies : [],
    blockedFamilies,
    families: {
      sapHeartwood: {
        occupied: sapHeartwoodOccupied,
        semanticMaskVersionId: params.sapHeartwoodVersion?.id ?? null,
        hasSapwood: params.hasSapwood,
        hasHeartwood: params.hasHeartwood,
      },
      cuSupport: {
        occupied: cuSupportOccupied,
        copperMaskVersionId: params.copperVersion?.id ?? null,
        supportMaskVersionId: params.supportVersion?.id ?? null,
        hasCopper: params.hasCopper,
        hasSupport: params.hasSupport,
      },
    },
  };
}

export async function resolveCropAnnotationFamilyState(params: {
  db?: CropAnnotationFamilyDb;
  crop: CropForFamily;
}) {
  const db = params.db ?? (await import("@/server/db")).prisma;
  const labels = await familyLabelValuesForProject(db, params.crop.projectId);
  const [sapHeartwoodVersion, copperVersion, supportVersion] = await Promise.all([
    latestArtifactVersion({
      db,
      crop: params.crop,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      scopeKey: cropSemanticMaskScopeKey(params.crop.id, CropSemanticMode.SAP_HEARTWOOD),
      semanticMode: CropSemanticMode.SAP_HEARTWOOD,
    }),
    latestArtifactVersion({
      db,
      crop: params.crop,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      scopeKey: cropSemanticMaskScopeKey(params.crop.id, CropSemanticMode.COPPER),
      semanticMode: CropSemanticMode.COPPER,
    }),
    latestArtifactVersion({
      db,
      crop: params.crop,
      kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      scopeKey: cropSupportMaskScopeKey(params.crop.id),
    }),
  ]);
  const [sapHeartwoodOccupancy, copperOccupancy, hasSupport] = await Promise.all([
    semanticVersionOccupancy({
      semanticMode: CropSemanticMode.SAP_HEARTWOOD,
      version: sapHeartwoodVersion,
      labels,
    }),
    semanticVersionOccupancy({
      semanticMode: CropSemanticMode.COPPER,
      version: copperVersion,
      labels,
    }),
    supportVersionOccupancy({
      version: supportVersion,
      labels,
    }),
  ]);

  return buildState({
    sapHeartwoodVersion,
    copperVersion,
    supportVersion,
    hasSapwood: sapHeartwoodOccupancy.hasSapwood,
    hasHeartwood: sapHeartwoodOccupancy.hasHeartwood,
    hasCopper: copperOccupancy.hasCopper,
    hasSupport,
  });
}

export async function assertCropSemanticFamilySaveAllowed(params: {
  db: CropAnnotationFamilyDb;
  crop: CropForFamily;
  semanticMode: CropSemanticMode;
  semanticBytes: Uint8Array;
}) {
  const labels = await familyLabelValuesForProject(params.db, params.crop.projectId);
  const nextOccupied = semanticBytesOccupyAnnotationFamily({
    semanticMode: params.semanticMode,
    semanticBytes: params.semanticBytes,
    labels,
  });
  if (!nextOccupied) return;

  const state = await resolveCropAnnotationFamilyState({ db: params.db, crop: params.crop });
  const requestedFamily: CropAnnotationFamily =
    params.semanticMode === CropSemanticMode.SAP_HEARTWOOD ? "SAP_HEARTWOOD" : "CU_SUPPORT";
  const oppositeOccupied =
    requestedFamily === "SAP_HEARTWOOD"
      ? state.families.cuSupport.occupied
      : state.families.sapHeartwood.occupied;
  if (oppositeOccupied) {
    throw new CropAnnotationFamilyWorkflowError(CROP_ANNOTATION_FAMILY_CONFLICT);
  }
}

export async function assertCropSupportFamilySaveAllowed(params: {
  db: CropAnnotationFamilyDb;
  crop: CropForFamily;
  supportBytes: Uint8Array;
}) {
  const labels = await familyLabelValuesForProject(params.db, params.crop.projectId);
  if (!supportBytesOccupyAnnotationFamily({ supportBytes: params.supportBytes, labels })) return;

  const state = await resolveCropAnnotationFamilyState({ db: params.db, crop: params.crop });
  if (state.families.sapHeartwood.occupied) {
    throw new CropAnnotationFamilyWorkflowError(CROP_ANNOTATION_FAMILY_CONFLICT);
  }
}

export function cropAnnotationFamilyErrorResponse(error: unknown): { error: string; status: number } | null {
  if (error instanceof CropAnnotationFamilyWorkflowError) {
    return {
      error: error.code,
      status: error.code === CROP_ANNOTATION_FAMILY_CONFLICT ? 409 : 400,
    };
  }
  return null;
}
