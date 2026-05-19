# Images Feature

Images are uploaded through presigned S3/MinIO URLs and committed to the database after upload.

Important files:

- `src/app/(workspace)/app/projects/[projectId]/images/page.tsx`
- `src/features/images/ProjectImagesPage.tsx`
- `src/features/images/ImagesClient.tsx`
- `src/app/api/projects/[projectId]/images/*`

Image UI lives in `src/features/images` while routes stay stable.
