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
- `src/app/api/images/[imageId]/slice-bboxes/route.ts`
- `src/app/api/slice-bboxes/[bboxVersionId]/route.ts`
- `src/app/api/images/[imageId]/slice-crops/route.ts`
- `src/app/api/slice-bboxes/[bboxVersionId]/crop/route.ts`
- `src/app/api/slice-crops/[cropId]/route.ts`
- `src/app/api/slice-crops/[cropId]/asset/route.ts`
- `src/app/api/slice-crops/[cropId]/support-mask/*`
- `src/app/api/slice-crops/[cropId]/semantic-mask/*`
- `src/app/api/images/[imageId]/slice/*`
- `src/app/api/images/[imageId]/support-mask/*`
- `src/app/api/images/[imageId]/review-state/route.ts`
- `src/lib/projectsClient.ts`

Image UI lives in `src/features/images` while routes stay stable.

## Current Desktop Browser Workflow

- `/app/projects/[projectId]/images` lists images for the project.
- Editable project roles can upload an image through `POST /api/projects/[projectId]/images/upload`.
- Browser image reads use app-mediated asset routes rather than direct MinIO URLs.
- Browser helper types in `src/lib/projectsClient.ts` mirror that app-mediated route surface and do not expose `ImageAsset.storageKey`.
- The app-mediated upload path accepts PNG and JPEG images only. SVG and other formats are rejected before an image row is created.
- Uploaded images appear in the image list with validation/readiness hints, T-number state, and links to metadata and the editor.
- `/app/projects/[projectId]/images/[imageId]` shows immutable technical image metadata and editable image-level acquisition/sample metadata.
- The image list and metadata page link to the crop workflow entry route for image-level BBox set confirmation. The editor can maintain one default slice support geometry and slice classification for each uploaded image.

## Current Data Captured

- `ImageAsset.projectId` ties the image to exactly one annotation project.
- `ImageAsset.storageKey` records the S3/MinIO object key and is unique.
- `ImageAsset.filename`, `contentType`, `size`, `checksum`, dimensions, and validation status record the artifact baseline for validated uploads.
- RB-055 stores canonical SHA-256 checksums as `sha256:<hex>`, extracts PNG/JPEG dimensions server-side, and sets successful uploads to `VALIDATED`.
- `ImageAsset.uploadedById` records the uploader when the app-mediated upload or commit route is used by an authenticated user.
- `ImageAcquisitionMetadata` captures optional camera/device, lens/objective, exposure, aperture, ISO, white balance, color profile, lighting setup, captured-by, captured-at, and notes.
- `SampleMetadata` captures image-level/default T-number, specimen identifier, slice index, replicate, treatment/reference, and notes.
- RB-050 treats `SampleMetadata` as image-level/default metadata only. Slice-specific metadata remains deferred to the future `SliceInstance` workflow.
- RB-051 creates a default `SliceInstance` when support-mask or classification writes need one.
- RB-086 creates additional `SliceInstance` rows for source-image BBox slice proposals. Each saved proposal is versioned as `SliceBoundingBoxVersion` in `SOURCE_IMAGE_PIXEL` coordinate space.
- RB-094 creates `ImageCropWorkflowState` rows for image-level BBox set confirmation. Confirmation snapshots current active BBox version ids and is invalidated to `NEEDS_UPDATE` by later BBox create/replace/delete actions.
- RB-087 creates `DerivedSliceCrop` rows and private PNG crop objects from active BBox versions. Each crop records source image checksum/dimensions, BBox version, slice instance, padding, clipped source rectangle, `CROP_PIXEL` dimensions, and transform metadata.
- RB-088 creates crop-scoped support mask versions linked to `DerivedSliceCrop` and `SliceInstance`. These masks use `CROP_PIXEL`, match crop dimensions exactly, and provide the pixel-perfect support geometry for crop workflows.
- RB-089 creates crop-scoped semantic mask versions linked to the source image, `DerivedSliceCrop`, `SliceInstance`, exact support mask version, and semantic mode. These masks use `CROP_PIXEL`, match crop dimensions exactly, and cannot contain non-background semantic bytes outside support.
- RB-090 derives draft slice-classification suggestions from saved crop semantic masks and stores source/reason plus links back to the semantic mask, support mask, and crop. Manual overrides append separate `MANUAL` classification versions for the slice instance.
- Support geometry is stored as separate `SLICE_SUPPORT_MASK` artifact versions; it is not inferred from semantic masks.
- BBox proposals are rough crop planning artifacts only. They are not support geometry and are not exported as pixel-perfect instance ground truth.
- Derived crop padding is editing context only and must not be interpreted as support geometry.
- Slice classification is stored as `SliceClassificationVersion` with actor and label schema version.
- RB-052 lets the current semantic mask version, support mask version, and slice classification version move from draft to submitted and then approved/rejected.

## Current API Surface

- `POST /api/projects/[projectId]/images/upload` is the current customer-trial browser path. It checks upload size, content type, checksum hints, PNG/JPEG dimensions, object stat metadata, and then records a validated image row.
- `POST /api/projects/[projectId]/images/presign` and `POST /api/projects/[projectId]/images/commit` remain legacy/internal compatibility paths. Presign accepts PNG/JPEG only, and commit re-reads the private object before persisting verified metadata. The supported customer-trial browser helper is `apiUploadImage`, not the presign/commit pair.
- `GET /api/projects/[projectId]/images` lists project images without exposing private storage keys to the browser UI.
- `GET /api/images/[imageId]/metadata` returns the image metadata bundle, membership role, edit capability, and computed completeness summary.
- `PATCH /api/images/[imageId]/metadata` updates acquisition/sample metadata for editable project roles and rejects immutable image facts such as checksums or dimensions.
- `GET /api/images/[imageId]/slice` returns default-slice state, latest support mask, latest classification, and support label byte values.
- `POST /api/images/[imageId]/slice/ensure` creates the default slice instance for editable roles.
- `PATCH /api/images/[imageId]/slice/classification` appends a slice classification version.
- `GET /api/slices/[sliceInstanceId]/classification` returns latest classification state for a crop/BBox slice instance.
- `POST /api/slices/[sliceInstanceId]/classification` appends a manual classification override for a crop/BBox slice instance.
- `GET /api/images/[imageId]/slice-bboxes` lists the current active BBox proposal per slice instance for project members.
- `POST /api/images/[imageId]/slice-bboxes` creates a new `SliceInstance` plus first active `SliceBoundingBoxVersion` for editable project roles.
- `POST /api/images/[imageId]/slice-bboxes/confirm` confirms the current active BBox set as workflow planning state for editable project roles.
- `PATCH /api/slice-bboxes/[bboxVersionId]` appends a replacement BBox version for the same slice instance when the target version is still current.
- `DELETE /api/slice-bboxes/[bboxVersionId]` appends a `DELETED` BBox version and clears the denormalized current `SliceInstance.boundingBox` summary.
- `GET /api/images/[imageId]/slice-crops` lists sanitized derived crop metadata for project members.
- `POST /api/slice-bboxes/[bboxVersionId]/crop` generates a private PNG derived crop for editable project roles. Optional `paddingRequestedPx` accepts `0`, `16`, `32`, or `64`; omitted uses runtime default `32`.
- `GET /api/slice-crops/[cropId]` returns sanitized crop metadata for project members.
- `GET /api/slice-crops/[cropId]/asset` streams the private PNG crop through the app without exposing object storage keys.
- `GET /api/slice-crops/[cropId]/support-mask` returns crop support-mask readiness and latest version metadata for project members.
- `POST /api/slice-crops/[cropId]/support-mask/upload` uploads crop-sized support bytes through the app server and records a crop-linked `SLICE_SUPPORT_MASK` artifact version.
- `GET /api/slice-crops/[cropId]/semantic-mask` returns crop semantic-mask readiness, current support version metadata, mode label options, and latest Sap/Heartwood and Copper semantic versions for project members.
- `POST /api/slice-crops/[cropId]/semantic-mask/upload` uploads crop-sized semantic bytes through the app server, records a crop-linked `SEMANTIC_MASK` artifact version constrained by `x-support-mask-version-id` and `x-semantic-mode`, and appends a draft auto classification suggestion.
- `GET /api/images/[imageId]/support-mask/latest` returns latest support-mask metadata and an app-mediated asset URL.
- `POST /api/images/[imageId]/support-mask/upload` uploads support-mask bytes through the app server and records a `SLICE_SUPPORT_MASK` artifact version.
- `GET /api/images/[imageId]/review-state` returns latest and latest-approved review state for semantic mask, support mask, and slice classification.
- `GET /api/images/[imageId]/view` and `GET /api/images/[imageId]/asset` return or stream app-mediated image reads.
- Project-level export APIs consume latest approved image artifacts and classifications through `GET /api/projects/[projectId]/export/readiness` and `POST /api/projects/[projectId]/exports`.

## Upload Integrity Rules

- Supported raw image content types: `image/png` and `image/jpeg`.
- Unsupported image types return `UNSUPPORTED_CONTENT_TYPE`.
- Oversized uploads return `UPLOAD_TOO_LARGE` with `413` when the request reaches the app.
- Bad image bytes or unreadable dimensions return `IMAGE_DIMENSIONS_UNREADABLE`.
- Images beyond the trial full-resolution editor policy return `IMAGE_DIMENSIONS_UNSUPPORTED`: the maximum editable trial image is `8000x6000`, `48,000,000` pixels, with long edge at most `8000` and short edge at most `6000`.
- Images above `6000x4000` and within the trial maximum are accepted but marked with a large-image warning because full-resolution editing may use significant browser memory, especially on iPad.
- Optional client checksum hints are normalized and checked against the server-computed `sha256:<hex>` value; mismatches return `CHECKSUM_MISMATCH`.
- Storage keys are generated or constrained server-side. Browser API responses do not include private object-store URLs or storage keys.
- Successful upload and compatibility commit events create `IMAGE_UPLOAD_ACCEPTED` audit rows. Rejected uploads create `IMAGE_UPLOAD_REJECTED` rows where the request is authenticated and reaches application code.

## MVP Limitations

- Legacy presigned upload/view routes remain for compatibility, but the trial browser workflow and `src/lib` helper contract use app-mediated upload and read paths so MinIO can stay private.
- Metadata completeness is visible as readiness information. Missing T-number and missing technical metadata are warnings, not hard blockers yet.
- One default pixel-perfect slice/support geometry per image exists for full-image editing. Crop workflows can also save crop-scoped support geometry per derived crop.
- Tiling, downscaled working masks, sparse/patch uploads, hard multi-tab locking, and large-image edit-session soft locks remain deferred.
- RB-086/RB-087/RB-088/RB-089/RB-090/RB-091/RB-092 support multiple BBox slice proposals, derived crop generation, crop support-mask editing, support-constrained crop semantic editing, draft semantic-derived classification suggestions, crop training export, and crop-aware review/readiness. Slice-specific metadata, source-image-space crop-mask reprojection, and multi-object pixel-perfect support editing remain deferred.
- RB-053 exports approved semantic/support/classification data only and warns about missing metadata or missing approved components.
