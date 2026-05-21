# Server Storage

Storage helpers create S3/MinIO presigned URLs for compatibility paths and app-mediated object reads/writes for the browser trial path.

Key files:

- `src/server/storage/s3.ts` - active storage helper module.
- `src/server/domain/storageCleanup.ts` - RB-066 temporary-object retention cleanup service.
- `docker-compose.yml`

Trial browser invariant:

- Browsers should talk to the Next.js app for image and mask upload/read operations.
- MinIO console and S3 API stay private unless explicitly exposed for admin maintenance.
- App-mediated writes verify object existence, stored size, and content type where supported by the S3/MinIO `HEAD` operation before database commit.
- App-mediated image uploads support only PNG and JPEG. SVG is not accepted as a raw training image upload format.
- Raw image and mask API responses must not expose private MinIO/S3 URLs or credentials.
- Browser-facing helpers in `src/lib` use app-mediated routes and do not expose `storageKey`, bucket names, endpoints, upload URLs, or download URL internals.
- Presign/commit routes for images and semantic masks remain legacy/internal compatibility endpoints for now. They are not the recommended customer-trial browser contract and should not be used by new UI work unless a later ticket explicitly revisits direct upload compatibility.
- RB-066 cleanup may delete only temporary/staged objects after retention: batch staging files, possible temporary batch ZIPs under the batch staging prefix, and identifiable abandoned presigned image/mask uploads. Database references protect raw images, artifact versions, prediction artifacts, and exports.

Operational cleanup runbook:

- [storage-retention-cleanup.md](storage-retention-cleanup.md)
