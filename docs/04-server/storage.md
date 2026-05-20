# Server Storage

Storage helpers create S3/MinIO presigned URLs for compatibility paths and app-mediated object reads/writes for the browser trial path.

Key files:

- `src/server/storage/s3.ts` - active storage helper module.
- `src/server/storage.ts` - legacy duplicate helper; currently unused by active code and tracked for cleanup.
- `docker-compose.yml`

Trial browser invariant:

- Browsers should talk to the Next.js app for image and mask upload/read operations.
- MinIO console and S3 API stay private unless explicitly exposed for admin maintenance.
- App-mediated writes verify object existence, stored size, and content type where supported by the S3/MinIO `HEAD` operation before database commit.
- App-mediated image uploads support only PNG and JPEG. SVG is not accepted as a raw training image upload format.
- Raw image and mask API responses must not expose private MinIO/S3 URLs or credentials.
