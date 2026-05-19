# Images Feature

Images are uploaded through the app server and stored in S3/MinIO. The browser should not need direct access to MinIO for the customer-trial path.

Important files:

- `src/app/(workspace)/app/projects/[projectId]/images/page.tsx`
- `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/page.tsx`
- `src/features/images/ProjectImagesPage.tsx`
- `src/features/images/ImagesClient.tsx`
- `src/features/images/ImageMetadataPage.tsx`
- `src/features/images/ImageMetadataClient.tsx`
- `src/app/api/projects/[projectId]/images/*`
- `src/app/api/images/[imageId]/metadata/route.ts`
- `src/app/api/images/[imageId]/slice/*`
- `src/app/api/images/[imageId]/support-mask/*`
- `src/app/api/images/[imageId]/review-state/route.ts`

Image UI lives in `src/features/images` while routes stay stable.

## Current Desktop Browser Workflow

- `/app/projects/[projectId]/images` lists images for the project.
- Editable project roles can upload an image through `POST /api/projects/[projectId]/images/upload`.
- Browser image reads use app-mediated asset routes rather than direct MinIO URLs.
- Uploaded images appear in the image list with validation/readiness hints, T-number state, and links to metadata and the editor.
- `/app/projects/[projectId]/images/[imageId]` shows immutable technical image metadata and editable image-level acquisition/sample metadata.
- The editor can maintain one default slice support geometry and slice classification for each uploaded image.

## Current Data Captured

- `ImageAsset.projectId` ties the image to exactly one annotation project.
- `ImageAsset.storageKey` records the S3/MinIO object key and is unique.
- `ImageAsset.filename`, `contentType`, `size`, optional `checksum`, optional dimensions, and validation status record the artifact baseline.
- The app-mediated upload path now stores a SHA-256 checksum when the app server receives the image bytes.
- `ImageAsset.uploadedById` records the uploader when the app-mediated upload or commit route is used by an authenticated user.
- `ImageAcquisitionMetadata` captures optional camera/device, lens/objective, exposure, aperture, ISO, white balance, color profile, lighting setup, captured-by, captured-at, and notes.
- `SampleMetadata` captures image-level/default T-number, specimen identifier, slice index, replicate, treatment/reference, and notes.
- RB-050 treats `SampleMetadata` as image-level/default metadata only. Slice-specific metadata remains deferred to the future `SliceInstance` workflow.
- RB-051 creates a default `SliceInstance` when support-mask or classification writes need one.
- Support geometry is stored as separate `SLICE_SUPPORT_MASK` artifact versions; it is not inferred from semantic masks.
- Slice classification is stored as `SliceClassificationVersion` with actor and label schema version.
- RB-052 lets the current semantic mask version, support mask version, and slice classification version move from draft to submitted and then approved/rejected.

## Current API Surface

- `POST /api/projects/[projectId]/images/upload` is the current customer-trial browser path and writes the object through the app server.
- `POST /api/projects/[projectId]/images/presign` and `POST /api/projects/[projectId]/images/commit` remain compatibility paths.
- `GET /api/projects/[projectId]/images` lists project images without exposing private storage keys to the browser UI.
- `GET /api/images/[imageId]/metadata` returns the image metadata bundle, membership role, edit capability, and computed completeness summary.
- `PATCH /api/images/[imageId]/metadata` updates acquisition/sample metadata for editable project roles and rejects immutable image facts such as checksums or dimensions.
- `GET /api/images/[imageId]/slice` returns default-slice state, latest support mask, latest classification, and support label byte values.
- `POST /api/images/[imageId]/slice/ensure` creates the default slice instance for editable roles.
- `PATCH /api/images/[imageId]/slice/classification` appends a slice classification version.
- `GET /api/images/[imageId]/support-mask/latest` returns latest support-mask metadata and an app-mediated asset URL.
- `POST /api/images/[imageId]/support-mask/upload` uploads support-mask bytes through the app server and records a `SLICE_SUPPORT_MASK` artifact version.
- `GET /api/images/[imageId]/review-state` returns latest and latest-approved review state for semantic mask, support mask, and slice classification.
- `GET /api/images/[imageId]/view` and `GET /api/images/[imageId]/asset` return or stream app-mediated image reads.
- Project-level export APIs consume latest approved image artifacts and classifications through `GET /api/projects/[projectId]/export/readiness` and `POST /api/projects/[projectId]/exports`.

## MVP Limitations

- Image upload validates size and stores checksums for the app-mediated path, but checksum enforcement, object metadata verification, image dimension validation, and audit hardening remain RB-055.
- Legacy presigned upload/view routes remain for compatibility, but the trial browser workflow should use app-mediated upload and read paths so MinIO can stay private.
- Metadata completeness is visible as readiness information. Missing T-number and missing technical metadata are warnings, not hard blockers yet.
- Only one default slice/support geometry per image is implemented.
- Multi-slice and multi-object workflows remain deferred.
- RB-053 exports approved semantic/support/classification data only and warns about missing metadata or missing approved components.
