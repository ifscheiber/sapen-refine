import { Prisma } from "@prisma/client";

const VERSION_ALLOCATION_LOCK_NAMESPACE = "sapen-annotate-version-allocation";

export const VERSION_ALLOCATION_CONFLICT = "VERSION_ALLOCATION_CONFLICT";

export class VersionAllocationError extends Error {
  readonly code = VERSION_ALLOCATION_CONFLICT;
  readonly status = 409;

  constructor(readonly familyKey: string) {
    super(VERSION_ALLOCATION_CONFLICT);
    this.name = "VersionAllocationError";
  }
}

export function isVersionAllocationError(error: unknown): error is VersionAllocationError {
  return error instanceof VersionAllocationError;
}

function uniqueConflictTarget(error: Prisma.PrismaClientKnownRequestError) {
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  return [];
}

function isVersionUniqueConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = uniqueConflictTarget(error);
  return target.length === 0 || target.includes("version");
}

export async function withVersionAllocationLock<T>(
  tx: Prisma.TransactionClient,
  familyKey: string,
  callback: () => Promise<T>,
): Promise<T> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${VERSION_ALLOCATION_LOCK_NAMESPACE}),
      hashtext(${familyKey})
    )
  `;

  try {
    return await callback();
  } catch (error) {
    if (isVersionUniqueConflict(error)) {
      throw new VersionAllocationError(familyKey);
    }
    throw error;
  }
}

export function annotationArtifactVersionFamilyKey(params: {
  imageId: string;
  kind: string;
  scopeKey: string;
}) {
  return `annotation-artifact-version:${params.imageId}:${params.kind}:${params.scopeKey}`;
}

export function sliceClassificationVersionFamilyKey(sliceInstanceId: string) {
  return `slice-classification-version:${sliceInstanceId}`;
}

export function sliceBoundingBoxVersionFamilyKey(sliceInstanceId: string) {
  return `slice-bbox-version:${sliceInstanceId}`;
}

export function derivedSliceCropVersionFamilyKey(sliceInstanceId: string) {
  return `derived-slice-crop:${sliceInstanceId}`;
}
