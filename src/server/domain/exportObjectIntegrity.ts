import { getObjectBytes } from "@/server/storage/s3";
import { normalizeChecksum, sha256Checksum } from "@/server/uploads/integrity";

export type ExportObjectIntegrityDetails = {
  resourceType: string;
  resourceId: string;
  expectedChecksum: string | null;
  actualChecksum: string | null;
  expectedSize: number | null;
  actualSize: number | null;
};

export class ExportObjectIntegrityError extends Error {
  constructor(
    public readonly code:
      | "EXPORT_OBJECT_INTEGRITY_METADATA_MISSING"
      | "EXPORT_OBJECT_INTEGRITY_MISMATCH",
    public readonly details: ExportObjectIntegrityDetails,
    public readonly status = 409,
  ) {
    super(code);
  }
}

export async function getVerifiedExportObjectBytes(params: {
  storageKey: string;
  expectedChecksum: string | null | undefined;
  expectedSize: number | null | undefined;
  resourceType: string;
  resourceId: string;
}) {
  const bytes = await getObjectBytes(params.storageKey);
  const expectedChecksum = normalizeChecksum(params.expectedChecksum);
  const expectedSize =
    typeof params.expectedSize === "number" && Number.isInteger(params.expectedSize)
      ? params.expectedSize
      : null;
  const actualChecksum = sha256Checksum(bytes);
  const actualSize = bytes.byteLength;

  const details: ExportObjectIntegrityDetails = {
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    expectedChecksum,
    actualChecksum,
    expectedSize,
    actualSize,
  };

  if (!expectedChecksum || expectedSize === null) {
    throw new ExportObjectIntegrityError("EXPORT_OBJECT_INTEGRITY_METADATA_MISSING", details);
  }

  if (expectedChecksum !== actualChecksum || expectedSize !== actualSize) {
    throw new ExportObjectIntegrityError("EXPORT_OBJECT_INTEGRITY_MISMATCH", details);
  }

  return bytes;
}
