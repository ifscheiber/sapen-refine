# Annotation From Scratch

## Purpose

This is the current primary workflow for SaPen Annotate.

## Current Flow

1. User signs in through `/login`.
2. User opens `/app` or `/app/projects`.
3. User creates or selects a project.
4. User uploads a PNG/JPEG image through project image routes; the server validates checksum, dimensions, size, and object metadata before recording the image.
5. User opens `/app/projects/[projectId]/images/[imageId]/crop`.
6. User draws and edits rough BBox slice proposals in the BBox stage. These proposals are planning artifacts only, not support-mask ground truth; overlapping BBoxes must be resolved before confirmation.
7. User confirms the BBox set and the app generates current derived crops. Each crop is a private derived PNG with source-image lineage, not a raw uploaded image and not support geometry.
8. User opens the unified crop annotation editor for a selected slice.
9. User chooses one annotation family for the crop: `Sapwood / Heartwood` or `Cu`. Support is selected as a Cu-family label when Copper support geometry is required.
10. User draws the selected crop family with mode-aware support policy. Sap/Heartwood can save without explicit support and derives support from semantic foreground; Copper drafts can save before support but require approved explicit support for readiness/export. The app blocks non-empty saves in the opposite family until the active family is cleared.
11. User reviews the auto-derived slice classification or appends a manual override.
12. Crop editors upload serialized `u8raw-v1` mask bytes through the app server; the server validates byte length, dimensions, checksum, support-mask values where applicable, coordinate space, lineage, and appends `AnnotationArtifactVersion` rows.
13. User submits and, with `OWNER`/`QA` permission, approves crop semantic mask, crop support mask where required, and classification versions.
14. Latest crop masks can be reloaded through `/api/slice-crops/[cropId]/semantic-mask` and `/api/slice-crops/[cropId]/support-mask`; BBox proposals reload through `/api/images/[imageId]/slice-bboxes`; derived crops reload through `/api/images/[imageId]/slice-crops`; crop readiness is read through `/api/projects/[projectId]/crop-readiness`.
15. A project `OWNER` can open `/app/projects/[projectId]/exports`, create a crop training export from ready approved crop artifacts, and download the generated manifest/package through app routes.

## Important Files

- `src/app/(public)/login/page.tsx`
- `src/app/(workspace)/app/layout.tsx`
- `src/components/shell/AppShell.tsx`
- `src/features/editor/EditorClient.tsx`
- `src/app/api/projects/[projectId]/images/*`
- `src/app/api/images/[imageId]/mask/*`
- `src/app/api/images/[imageId]/slice-bboxes/route.ts`
- `src/app/api/slice-bboxes/[bboxVersionId]/route.ts`
- `src/app/api/images/[imageId]/slice-crops/route.ts`
- `src/app/api/slice-bboxes/[bboxVersionId]/crop/route.ts`
- `src/app/api/slice-crops/[cropId]/asset/route.ts`
- `src/app/api/slice-crops/[cropId]/support-mask/*`
- `src/app/api/images/[imageId]/support-mask/*`
- `src/app/api/images/[imageId]/review-state/route.ts`
- `src/app/api/artifact-versions/[versionId]/review/route.ts`
- `src/app/api/slice-classification-versions/[versionId]/review/route.ts`
- `src/app/api/projects/[projectId]/export/readiness/route.ts`
- `src/app/api/projects/[projectId]/exports/route.ts`
- `src/app/api/exports/[exportId]/download/route.ts`
- `src/features/projects/ProjectExportPanel.tsx`

## Invariants And Constraints

- Raw images should be immutable after commit.
- Raw images and masks should have server-verified checksums and dimensions before they are exportable.
- Mask and classification saves must append versions.
- BBox proposal replacement and deletion must append versions.
- Derived crop generation must append crop versions and preserve historical crops.
- Crop padding must not be interpreted as support geometry.
- Approved versions must not be overwritten by later edits.
- Writes must be tied to an authenticated user.

## Known Gaps

- Advanced export filters/history/job handling are not implemented.
- Multi-object support annotation remains deferred; crop semantic editing is implemented for the crop workflow.

## Related Tickets / Docs

- [../src/components/editor.md](../src/components/editor.md)
- [../prisma/schema.md](../prisma/schema.md)
