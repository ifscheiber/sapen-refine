# Server Storage

## Purpose

Server storage helpers create presigned S3/MinIO URLs for compatibility paths and app-mediated S3/MinIO writes for customer-trial upload operations.

## Important Files

- `src/server/storage/s3.ts` - AWS SDK client setup and low-level presign helpers.
- `src/server/runtime/config.ts` - validates storage endpoint, credentials, bucket, and upload limits.
- `src/server/uploads/validation.ts` - validates image and mask upload sizes.
- `src/server/storage.ts` - app-level wrapper functions.
- `src/app/api/projects/[projectId]/images/presign/route.ts` - image upload presign.
- `src/app/api/projects/[projectId]/images/upload/route.ts` - app-mediated raw-image upload.
- `src/app/api/images/[imageId]/mask/presign/route.ts` - mask upload presign.
- `src/app/api/images/[imageId]/mask/upload/route.ts` - app-mediated mask upload.

## Public Interfaces / Routes / Functions

- `getPresignedPutUrl(key, contentType)`.
- `getPresignedGetUrl(key)`.
- `putObject(key, body, contentType)`.
- `checkStorageReady()`.
- Local storage service: MinIO from `docker-compose.yml`.

## Invariants And Constraints

- Raw image files must not be overwritten after commit.
- Mask versions must be append-only artifacts.
- Object storage keys should be generated server-side, not trusted from arbitrary client paths.
- Customer-trial browser uploads should go through the app server by default, so MinIO console and S3 API can remain private.

## Known Gaps

- Object existence, checksums, dimensions, and content type are not fully verified at commit time.
- Production bucket policy and lifecycle rules are not documented yet.

## Related Tickets / Docs

- [../../operations/environment.md](../../operations/environment.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
