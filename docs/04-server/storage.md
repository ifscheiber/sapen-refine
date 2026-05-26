# Server Storage

Storage helpers provide app-mediated S3/MinIO object reads/writes for the browser trial path. The low-level presign helpers still exist, but RB-105 disables the legacy presign/commit upload routes so they no longer issue client-writeable final object URLs.

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
- Presign/commit routes for images and semantic masks remain as disabled legacy/internal compatibility endpoints. After auth/RBAC they return `410 PRESIGNED_UPLOADS_DISABLED`; any future direct-upload compatibility must use staging keys and a fresh server-owned final key.
- Export packaging verifies each packaged image, artifact version, and derived crop against persisted checksum and size before writing ZIP bytes.
- RB-066/RB-137 cleanup may delete only temporary/staged or unreferenced workflow objects after retention: batch staging files, possible temporary batch ZIPs under the batch staging prefix, historical abandoned presigned image/mask uploads created before RB-105, and unreferenced crop workflow objects under `derived-crops`, `crop-support-masks`, or `crop-semantic-masks`. Database references protect raw images, derived crops, artifact versions, prediction artifacts, and exports.

Operational cleanup runbook:

- [storage-retention-cleanup.md](storage-retention-cleanup.md)
