# Server Storage

## Purpose

Server storage helpers create presigned S3/MinIO URLs for compatibility paths and app-mediated S3/MinIO reads/writes for customer-trial browser operations.

## Important Files

- `src/server/storage/s3.ts` - active AWS SDK client setup, presign helpers, app-mediated reads/writes, object stat verification, object listing/deletion, best-effort deletes, and readiness check.
- `src/server/domain/storageCleanup.ts` - RB-066 retention cleanup for temporary batch staging and abandoned presigned-upload objects.
- `src/server/runtime/config.ts` - validates storage endpoint, credentials, bucket, and upload limits.
- `src/server/uploads/validation.ts` - validates image and mask upload sizes.
- `src/server/uploads/integrity.ts` - computes SHA-256 checksums, validates PNG/JPEG dimensions, validates mask byte dimensions, and maps stable integrity errors.
- `src/server/storage.ts` - legacy duplicate presign helper using direct `process.env` access; active code does not import it and cleanup is tracked separately.
- `src/app/api/projects/[projectId]/images/presign/route.ts` - image upload presign.
- `src/app/api/projects/[projectId]/images/upload/route.ts` - app-mediated raw-image upload.
- `src/app/api/images/[imageId]/asset/route.ts` - app-mediated raw-image read.
- `src/app/api/images/[imageId]/mask/presign/route.ts` - mask upload presign.
- `src/app/api/images/[imageId]/mask/upload/route.ts` - app-mediated mask upload.
- `src/app/api/images/[imageId]/mask/versions/[versionId]/asset/route.ts` - app-mediated mask read.

## Public Interfaces / Routes / Functions

- Active `src/server/storage/s3.ts` functions include `getPresignedPutUrl`, `getPresignedGetUrl`, `putObject`, `statObject`, `verifyStoredObject`, `listObjectsByPrefix`, `deleteObject`, `deleteObjectBestEffort`, `getObjectBytes`, and `checkStorageReady`.
- `runStorageCleanup` in `src/server/domain/storageCleanup.ts` provides the admin-only dry-run/execute operational cleanup path.
- Local storage service: MinIO from `docker-compose.yml`.

## Invariants And Constraints

- Raw image files must not be overwritten after commit.
- Mask versions must be append-only artifacts.
- Object storage keys should be generated server-side, not trusted from arbitrary client paths.
- Customer-trial browser uploads and reads should go through the app server by default, so MinIO console and S3 API can remain private.
- Current image writes support only PNG/JPEG and persist server-verified `sha256:<hex>`, width, height, size, content type, and `VALIDATED` status.
- Current mask writes support `u8raw-v1` in image-pixel coordinates and reject dimension or byte-length mismatches.
- Support masks allow only `0` and the active `slice_support` label byte.
- Cleanup may delete only temporary/staged objects under allowed prefixes after retention. It must protect DB-referenced `ImageAsset` and `AnnotationArtifactVersion` objects and must not classify export prefixes as cleanup candidates.

## Known Gaps

- Production bucket policy, provider lifecycle rules, and replication are not documented yet.
- There is no cleanup dashboard UI. RB-066 provides API/CLI cleanup for identifiable batch staging and presigned-upload orphans only.

## Related Tickets / Docs

- [../../operations/environment.md](../../operations/environment.md)
- [../../04-server/storage-retention-cleanup.md](../../04-server/storage-retention-cleanup.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
