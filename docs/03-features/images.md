# Images Feature

Images are uploaded through the app server and stored in S3/MinIO. The browser should not need direct access to MinIO for the customer-trial path.

Important files:

- `src/app/(workspace)/app/projects/[projectId]/images/page.tsx`
- `src/features/images/ProjectImagesPage.tsx`
- `src/features/images/ImagesClient.tsx`
- `src/app/api/projects/[projectId]/images/*`

Image UI lives in `src/features/images` while routes stay stable.

## Current Desktop Browser Workflow

- `/app/projects/[projectId]/images` lists images for the project.
- Editable project roles can upload an image through `POST /api/projects/[projectId]/images/upload`.
- Browser image reads use app-mediated asset routes rather than direct MinIO URLs.
- Uploaded images appear in the image list and link to the editor.

## Current Data Captured

- `ImageAsset.projectId` ties the image to exactly one annotation project.
- `ImageAsset.storageKey` records the S3/MinIO object key and is unique.
- `ImageAsset.filename`, `contentType`, `size`, optional `checksum`, optional dimensions, and validation status record the artifact baseline.
- `ImageAsset.uploadedById` records the uploader when the app-mediated upload or commit route is used by an authenticated user.
- `ImageAcquisitionMetadata` and `SampleMetadata` exist as RB-049 persistence structures; full workflow capture remains RB-050.

## Current API Surface

- `POST /api/projects/[projectId]/images/upload` is the current customer-trial browser path and writes the object through the app server.
- `POST /api/projects/[projectId]/images/presign` and `POST /api/projects/[projectId]/images/commit` remain compatibility paths.
- `GET /api/projects/[projectId]/images` lists project images.
- `GET /api/images/[imageId]/view` and `GET /api/images/[imageId]/asset` return or stream app-mediated image reads.

## MVP Limitations

- Image upload validates size, but checksum enforcement, final acquisition metadata workflow, and image dimension validation remain future hardening work.
- Legacy presigned upload/view routes remain for compatibility, but the trial browser workflow should use app-mediated upload and read paths so MinIO can stay private.
- Structured sample/specimen/T-number and acquisition metadata tables exist, but user-facing capture remains RB-050.
- There is no explicit image validation status for training export readiness.
