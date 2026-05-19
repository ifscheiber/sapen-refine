# src/lib

## Purpose

`src/lib` contains browser-side API wrappers and shared client helpers.

## Important Files

- `src/lib/projectsClient.ts` - project/image list, project creation, image presign/commit, and image view URL helpers.
- `src/lib/imagesApi.ts` - direct image view and mask latest/presign/commit helpers.

## Public Interfaces / Routes / Functions

- `apiListProjects`, `apiCreateProject`, `apiListImages`, `apiGetImageViewUrl`, `apiPresignImageUpload`, `apiCommitImage`.
- `fetchImageView`, `apiGetLatestMask`, `apiPresignMask`, `apiCommitMask`.

## Invariants And Constraints

- Client wrappers may normalize fetch errors, but backend APIs remain the source of truth.
- Do not duplicate authorization or domain validation only in client code.

## Known Gaps

- Client API contracts are not covered by tests.
- Error handling is simple and should become more structured as workflows mature.

## Related Tickets / Docs

- [../app/api.md](../app/api.md)
- [../../testing/README.md](../../testing/README.md)
