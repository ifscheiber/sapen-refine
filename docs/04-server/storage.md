# Server Storage

Storage helpers create S3/MinIO presigned URLs for compatibility paths and app-mediated object reads/writes for the browser trial path.

Key files:

- `src/server/storage.ts`
- `src/server/storage/s3.ts`
- `docker-compose.yml`

Trial browser invariant:

- Browsers should talk to the Next.js app for image and mask upload/read operations.
- MinIO console and S3 API stay private unless explicitly exposed for admin maintenance.
