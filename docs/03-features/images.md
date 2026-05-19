# Images Feature

Images are uploaded through presigned S3/MinIO URLs and committed to the database after upload.

Important files:

- `src/app/app/projects/[projectId]/images/page.tsx`
- `src/app/app/projects/[projectId]/images/ui.tsx`
- `src/app/api/projects/[projectId]/images/*`

RB-043 target: move image UI into `src/features/images` while keeping routes stable.
