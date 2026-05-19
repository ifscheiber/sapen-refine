# Server Storage

## Purpose

Server storage helpers create presigned S3/MinIO URLs for raw image and mask artifact upload/view operations.

## Important Files

- `src/server/storage/s3.ts` - AWS SDK client setup and low-level presign helpers.
- `src/server/storage.ts` - app-level wrapper functions.
- `src/app/api/projects/[projectId]/images/presign/route.ts` - image upload presign.
- `src/app/api/images/[imageId]/mask/presign/route.ts` - mask upload presign.

## Public Interfaces / Routes / Functions

- `getPresignedPutUrl(key, contentType)`.
- `getPresignedGetUrl(key)`.
- Local storage service: MinIO from `docker-compose.yml`.

## Invariants And Constraints

- Raw image files must not be overwritten after commit.
- Mask versions must be append-only artifacts.
- Object storage keys should be generated server-side, not trusted from arbitrary client paths.

## Known Gaps

- Object existence, content length, checksums, dimensions, and content type are not fully verified at commit time.
- Production bucket policy and lifecycle rules are not documented yet.

## Related Tickets / Docs

- [../../operations/environment.md](../../operations/environment.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
