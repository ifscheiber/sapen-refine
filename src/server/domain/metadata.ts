import { canEditMetadata } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";

type MetadataDb = typeof prisma;

export type MetadataStatus =
  | "complete"
  | "incomplete"
  | "optional-missing"
  | "not-validated"
  | "failed-validation";

export type MetadataCompletenessItem = {
  key: string;
  label: string;
  status: MetadataStatus;
  requiredFor: "annotation" | "training-export" | "optional";
  message: string;
};

export type MetadataCompletenessSummary = {
  overall: MetadataStatus;
  items: MetadataCompletenessItem[];
};

type AcquisitionInput = {
  cameraDevice?: unknown;
  lensObjective?: unknown;
  exposure?: unknown;
  aperture?: unknown;
  iso?: unknown;
  whiteBalance?: unknown;
  colorProfile?: unknown;
  lightingSetup?: unknown;
  capturedBy?: unknown;
  capturedAt?: unknown;
  notes?: unknown;
};

type SampleInput = {
  tNumber?: unknown;
  specimenIdentifier?: unknown;
  sliceIndex?: unknown;
  replicate?: unknown;
  treatmentReference?: unknown;
  notes?: unknown;
};

export type ParsedMetadataUpdate = {
  acquisition?: {
    cameraDevice?: string | null;
    lensObjective?: string | null;
    exposure?: string | null;
    aperture?: string | null;
    iso?: string | null;
    whiteBalance?: string | null;
    colorProfile?: string | null;
    lightingSetup?: string | null;
    capturedBy?: string | null;
    capturedAt?: Date | null;
    notes?: string | null;
  };
  sample?: {
    tNumber?: string | null;
    specimenIdentifier?: string | null;
    sliceIndex?: number | null;
    replicate?: string | null;
    treatmentReference?: string | null;
    notes?: string | null;
  };
};

export class MetadataValidationError extends Error {
  constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
  }
}

const BODY_KEYS = new Set(["acquisition", "sample"]);
const ACQUISITION_KEYS = new Set([
  "cameraDevice",
  "lensObjective",
  "exposure",
  "aperture",
  "iso",
  "whiteBalance",
  "colorProfile",
  "lightingSetup",
  "capturedBy",
  "capturedAt",
  "notes",
]);
const SAMPLE_KEYS = new Set([
  "tNumber",
  "specimenIdentifier",
  "sliceIndex",
  "replicate",
  "treatmentReference",
  "notes",
]);

function assertPlainObject(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MetadataValidationError(code);
  }
  return value as Record<string, unknown>;
}

function assertKnownKeys(value: Record<string, unknown>, allowed: Set<string>, code: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new MetadataValidationError(code);
  }
}

function optionalString(value: unknown, field: string, maxLength = 255): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new MetadataValidationError(`${field.toUpperCase()}_INVALID`);

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw new MetadataValidationError(`${field.toUpperCase()}_TOO_LONG`);
  return trimmed;
}

function optionalDate(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new MetadataValidationError(`${field.toUpperCase()}_INVALID`);

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new MetadataValidationError(`${field.toUpperCase()}_INVALID`);
  }
  return parsed;
}

function optionalInteger(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new MetadataValidationError(`${field.toUpperCase()}_INVALID`);
  }
  return parsed;
}

export function parseMetadataUpdate(value: unknown): ParsedMetadataUpdate {
  const body = assertPlainObject(value, "BODY_INVALID");
  assertKnownKeys(body, BODY_KEYS, "IMMUTABLE_OR_UNKNOWN_FIELD");

  const parsed: ParsedMetadataUpdate = {};

  if (body.acquisition !== undefined) {
    const acquisition = assertPlainObject(body.acquisition, "ACQUISITION_INVALID") as AcquisitionInput;
    assertKnownKeys(acquisition as Record<string, unknown>, ACQUISITION_KEYS, "ACQUISITION_FIELD_UNKNOWN");
    parsed.acquisition = {
      cameraDevice: optionalString(acquisition.cameraDevice, "cameraDevice"),
      lensObjective: optionalString(acquisition.lensObjective, "lensObjective"),
      exposure: optionalString(acquisition.exposure, "exposure"),
      aperture: optionalString(acquisition.aperture, "aperture"),
      iso: optionalString(acquisition.iso, "iso"),
      whiteBalance: optionalString(acquisition.whiteBalance, "whiteBalance"),
      colorProfile: optionalString(acquisition.colorProfile, "colorProfile"),
      lightingSetup: optionalString(acquisition.lightingSetup, "lightingSetup"),
      capturedBy: optionalString(acquisition.capturedBy, "capturedBy"),
      capturedAt: optionalDate(acquisition.capturedAt, "capturedAt"),
      notes: optionalString(acquisition.notes, "notes", 2000),
    };
  }

  if (body.sample !== undefined) {
    const sample = assertPlainObject(body.sample, "SAMPLE_INVALID") as SampleInput;
    assertKnownKeys(sample as Record<string, unknown>, SAMPLE_KEYS, "SAMPLE_FIELD_UNKNOWN");
    parsed.sample = {
      tNumber: optionalString(sample.tNumber, "tNumber"),
      specimenIdentifier: optionalString(sample.specimenIdentifier, "specimenIdentifier"),
      sliceIndex: optionalInteger(sample.sliceIndex, "sliceIndex"),
      replicate: optionalString(sample.replicate, "replicate"),
      treatmentReference: optionalString(sample.treatmentReference, "treatmentReference"),
      notes: optionalString(sample.notes, "notes", 2000),
    };
  }

  return parsed;
}

export function computeMetadataCompleteness(input: {
  validationStatus: "PENDING" | "VALIDATED" | "FAILED";
  checksum?: string | null;
  width?: number | null;
  height?: number | null;
  sampleMetadata?: { tNumber?: string | null } | null;
  acquisitionMetadata?: {
    cameraDevice?: string | null;
    capturedAt?: Date | string | null;
    lightingSetup?: string | null;
  } | null;
}): MetadataCompletenessSummary {
  const items: MetadataCompletenessItem[] = [];

  if (input.validationStatus === "FAILED") {
    items.push({
      key: "image-validation",
      label: "Image validation",
      status: "failed-validation",
      requiredFor: "annotation",
      message: "Image validation failed.",
    });
  } else if (input.validationStatus === "PENDING") {
    items.push({
      key: "image-validation",
      label: "Image validation",
      status: "not-validated",
      requiredFor: "annotation",
      message: "Image has not been fully validated yet.",
    });
  } else {
    items.push({
      key: "image-validation",
      label: "Image validation",
      status: "complete",
      requiredFor: "annotation",
      message: "Image validation state is complete.",
    });
  }

  const hasExportTechnicalMetadata = Boolean(input.checksum && input.width && input.height);
  items.push({
    key: "technical-metadata",
    label: "Technical metadata",
    status: hasExportTechnicalMetadata ? "complete" : "incomplete",
    requiredFor: "training-export",
    message: hasExportTechnicalMetadata
      ? "Checksum and dimensions are present."
      : "Checksum or dimensions are missing; RB-055 will harden this path.",
  });

  const hasTNumber = Boolean(input.sampleMetadata?.tNumber?.trim());
  items.push({
    key: "t-number",
    label: "T-number",
    status: hasTNumber ? "complete" : "incomplete",
    requiredFor: "training-export",
    message: hasTNumber ? "T-number is present." : "T-number is missing.",
  });

  const hasAcquisitionHint = Boolean(
    input.acquisitionMetadata?.cameraDevice ||
      input.acquisitionMetadata?.capturedAt ||
      input.acquisitionMetadata?.lightingSetup
  );
  items.push({
    key: "acquisition-metadata",
    label: "Acquisition metadata",
    status: hasAcquisitionHint ? "complete" : "optional-missing",
    requiredFor: "optional",
    message: hasAcquisitionHint
      ? "Acquisition metadata has been started."
      : "Acquisition metadata is optional for annotation but useful for exports.",
  });

  const precedence: MetadataStatus[] = [
    "failed-validation",
    "not-validated",
    "incomplete",
    "optional-missing",
    "complete",
  ];
  const overall = precedence.find((status) => items.some((item) => item.status === status)) ?? "complete";

  return { overall, items };
}

export async function loadImageMetadataBundle(imageId: string, userId: string, db: MetadataDb = prisma) {
  const image = await db.imageAsset.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      projectId: true,
      filename: true,
      contentType: true,
      size: true,
      checksum: true,
      width: true,
      height: true,
      validationStatus: true,
      uploadedAt: true,
      uploadedBy: { select: { id: true, email: true, name: true } },
      project: {
        select: {
          id: true,
          name: true,
          labelSchemaVersion: { select: { id: true, name: true, version: true, status: true } },
        },
      },
      acquisitionMetadata: true,
      sampleMetadata: true,
    },
  });

  if (!image) return null;

  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId } },
    select: { role: true },
  });
  if (!membership) throw new MetadataValidationError("FORBIDDEN");

  return {
    image,
    project: image.project,
    myRole: membership.role,
    canEditMetadata: canEditMetadata(membership.role),
    completeness: computeMetadataCompleteness(image),
  };
}

export async function updateImageMetadataForUser(params: {
  imageId: string;
  userId: string;
  input: unknown;
}, db: MetadataDb = prisma) {
  const image = await db.imageAsset.findUnique({
    where: { id: params.imageId },
    select: { id: true, projectId: true },
  });
  if (!image) throw new MetadataValidationError("IMAGE_NOT_FOUND");

  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: params.userId } },
    select: { role: true },
  });
  if (!membership || !canEditMetadata(membership.role)) {
    throw new MetadataValidationError("FORBIDDEN");
  }

  const parsed = parseMetadataUpdate(params.input);

  if (parsed.acquisition) {
    await db.imageAcquisitionMetadata.upsert({
      where: { imageId: image.id },
      update: parsed.acquisition,
      create: { imageId: image.id, ...parsed.acquisition },
    });
  }

  if (parsed.sample) {
    await db.sampleMetadata.upsert({
      where: { imageId: image.id },
      update: parsed.sample,
      create: { imageId: image.id, ...parsed.sample },
    });
  }

  await recordAuditEvent({
    action: "IMAGE_METADATA_UPDATED",
    entity: "ImageAsset",
    entityId: image.id,
    actorId: params.userId,
    details: {
      projectId: image.projectId,
      sections: {
        acquisition: Boolean(parsed.acquisition),
        sample: Boolean(parsed.sample),
      },
    },
  }, db);

  return loadImageMetadataBundle(image.id, params.userId, db);
}

export function metadataErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof MetadataValidationError) {
    const status = error.code === "FORBIDDEN" ? 403 : error.code.endsWith("_NOT_FOUND") ? 404 : 400;
    return { error: error.code, status };
  }

  return { error: "METADATA_UPDATE_FAILED", status: 500 };
}
