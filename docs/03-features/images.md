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

## MVP Limitations

- Image upload validates size, but object checksums, final acquisition metadata, and image dimension validation remain future hardening work.
- Legacy presigned upload/view routes remain for compatibility, but the trial browser workflow should use app-mediated upload and read paths so MinIO can stay private.
