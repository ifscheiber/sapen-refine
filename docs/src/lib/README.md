# src/lib

## Purpose

`src/lib` contains small browser-side API wrappers and shared client helpers.

RB-074 aligns these helpers with the customer-trial storage contract: browser clients use app-mediated upload/read routes, while private object-store keys and presigned URL internals remain server-side details.

## Important Files

- `src/lib/projectsClient.ts` - project/image list, project creation, app-mediated image upload, and image view URL helpers.
- `src/lib/imagesApi.ts` - app-mediated image view, latest semantic/support mask metadata, and semantic/support mask upload helpers.

## Public Interfaces / Routes / Functions

- `apiListProjects`, `apiCreateProject`, `apiListImages`, `apiGetImageViewUrl`, `apiUploadImage`.
- `fetchImageView`, `apiGetLatestMask`, `apiGetLatestSupportMask`, `apiUploadSemanticMask`, `apiUploadSupportMask`.

Current helper route targets:

- `apiUploadImage` posts the raw `File` body to `POST /api/projects/[projectId]/images/upload` with `content-type` and `x-filename` headers.
- `apiUploadSemanticMask` posts raw `u8raw-v1` bytes to `POST /api/images/[imageId]/mask/upload` with `x-mask-width`, `x-mask-height`, `x-mask-format`, and diagnostic `x-mask-byte-length` headers when the body exposes a safe byte length.
- `apiUploadSupportMask` posts raw `u8raw-v1` bytes to `POST /api/images/[imageId]/support-mask/upload` with the same mask headers.
- Latest-mask helpers return app-mediated asset URLs and opaque version IDs. They do not expose private object-store keys.

## Invariants And Constraints

- Client wrappers may normalize fetch errors, but backend APIs remain the source of truth.
- Do not duplicate authorization or domain validation only in client code.
- Browser-facing `src/lib` types must not expose private storage details such as `storageKey`, bucket names, MinIO/S3 endpoints, or presigned upload internals.
- Compatibility presign/commit API routes may remain under `src/app/api`, but they are not the supported `src/lib` browser contract.

## Known Gaps

- Error handling is simple and should become more structured as workflows mature.
- `src/lib` intentionally stays small. Feature-specific editors may still use local route builders where that keeps ownership clearer, but those route builders must follow the same app-mediated storage contract.
- Presign/commit server routes remain compatibility endpoints and should be removed or feature-flagged only in a later explicit storage-compatibility slice.

## Related Tickets / Docs

- [../app/api.md](../app/api.md)
- [../../testing/README.md](../../testing/README.md)
