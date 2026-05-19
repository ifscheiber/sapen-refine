# Annotation From Scratch

## Purpose

This is the current primary workflow for SaPen Annotate.

## Current Flow

1. User signs in through `/login`.
2. User opens `/app` or `/app/projects`.
3. User creates or selects a project.
4. User uploads an image through project image routes.
5. User opens `/app/projects/[projectId]/images/[imageId]/edit`.
6. User draws semantic mask labels in the editor.
7. User can switch to slice-support mode and draw the physical slice support mask separately from semantic labels.
8. User can set the slice classification.
9. Editor uploads serialized mask bytes to S3/MinIO and appends `AnnotationArtifactVersion` rows.
10. User submits and, with `OWNER`/`QA` permission, approves semantic mask, support mask, and classification versions.
11. Latest masks can be reloaded through `/api/images/[imageId]/mask/latest` and `/api/images/[imageId]/support-mask/latest`; review readiness is read through `/api/images/[imageId]/review-state`.
12. A project `OWNER` can return to the project overview, create a training export from latest approved versions, and download the generated manifest/package through app routes.

## Important Files

- `src/app/(public)/login/page.tsx`
- `src/app/(workspace)/app/layout.tsx`
- `src/components/shell/AppShell.tsx`
- `src/features/editor/EditorClient.tsx`
- `src/app/api/projects/[projectId]/images/*`
- `src/app/api/images/[imageId]/mask/*`
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
- Mask and classification saves must append versions.
- Approved versions must not be overwritten by later edits.
- Writes must be tied to an authenticated user.

## Known Gaps

- Advanced export filters/history/job handling are not implemented.
- Multi-slice and multi-object annotation remain deferred.

## Related Tickets / Docs

- [../src/components/editor.md](../src/components/editor.md)
- [../prisma/schema.md](../prisma/schema.md)
