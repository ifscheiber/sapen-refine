import JSZip from "jszip";

import { getVerifiedExportObjectBytes } from "@/server/domain/exportObjectIntegrity";
import { deleteObjectBestEffort, putObject } from "@/server/storage/s3";
import { sha256Checksum } from "@/server/uploads/integrity";

export type ExportPackageSource = {
  objectRefId?: string;
  path: string;
  storageKey: string;
  expectedChecksum: string | null | undefined;
  expectedSize: number | null | undefined;
  resourceType: string;
  resourceId: string;
};

export type ExportPackageWriteResult = {
  manifestStorageKey: string;
  manifestChecksum: string;
  packageStorageKey: string;
  packageChecksum: string;
  packageSize: number;
};

export type ExportManifestWriteResult = {
  manifestStorageKey: string;
  manifestChecksum: string;
};

function encodeManifest(manifest: unknown) {
  return new TextEncoder().encode(JSON.stringify(manifest, null, 2));
}

export async function verifyExportPackageSources(sources: ExportPackageSource[]) {
  for (const source of sources) {
    await getVerifiedExportObjectBytes(source);
  }
}

export async function buildVerifiedZipPackage(params: {
  manifest: unknown;
  sources: ExportPackageSource[];
}) {
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(params.manifest, null, 2));

  for (const source of params.sources) {
    zip.file(source.path, await getVerifiedExportObjectBytes(source));
  }

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function writeExportPackageObjects(params: {
  manifest: unknown;
  sources: ExportPackageSource[];
  manifestStorageKey: string;
  packageStorageKey: string;
}): Promise<ExportPackageWriteResult> {
  let manifestWritten = false;
  let packageWriteAttempted = false;

  try {
    const manifestBytes = encodeManifest(params.manifest);
    const packageBytes = await buildVerifiedZipPackage({
      manifest: params.manifest,
      sources: params.sources,
    });

    await putObject(params.manifestStorageKey, manifestBytes, "application/json");
    manifestWritten = true;
    packageWriteAttempted = true;
    await putObject(params.packageStorageKey, packageBytes, "application/zip");

    return {
      manifestStorageKey: params.manifestStorageKey,
      manifestChecksum: sha256Checksum(manifestBytes),
      packageStorageKey: params.packageStorageKey,
      packageChecksum: sha256Checksum(packageBytes),
      packageSize: packageBytes.byteLength,
    };
  } catch (error) {
    if (manifestWritten) await deleteObjectBestEffort(params.manifestStorageKey);
    if (packageWriteAttempted) await deleteObjectBestEffort(params.packageStorageKey);
    throw error;
  }
}

export async function writeExportManifestObject(params: {
  manifest: unknown;
  manifestStorageKey: string;
}): Promise<ExportManifestWriteResult> {
  const manifestBytes = encodeManifest(params.manifest);
  await putObject(params.manifestStorageKey, manifestBytes, "application/json");
  return {
    manifestStorageKey: params.manifestStorageKey,
    manifestChecksum: sha256Checksum(manifestBytes),
  };
}

export async function deleteExportManifestObjectBestEffort(result: ExportManifestWriteResult) {
  await deleteObjectBestEffort(result.manifestStorageKey);
}

export async function deleteExportPackageObjectsBestEffort(result: ExportPackageWriteResult) {
  await Promise.all([
    deleteObjectBestEffort(result.manifestStorageKey),
    deleteObjectBestEffort(result.packageStorageKey),
  ]);
}
