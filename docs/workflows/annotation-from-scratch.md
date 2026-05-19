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
7. Editor uploads serialized mask bytes to S3/MinIO and commits a new `MaskVersion`.
8. Latest mask can be reloaded through `/api/images/[imageId]/mask/latest`.

## Important Files

- `src/app/(public)/login/page.tsx`
- `src/app/(workspace)/app/layout.tsx`
- `src/components/shell/AppShell.tsx`
- `src/features/editor/EditorClient.tsx`
- `src/app/api/projects/[projectId]/images/*`
- `src/app/api/images/[imageId]/mask/*`

## Invariants And Constraints

- Raw images should be immutable after commit.
- Mask saves must append versions.
- Writes must be tied to an authenticated user.

## Known Gaps

- Acquisition metadata capture is incomplete.
- Review/approval is not implemented.
- Export is not implemented.

## Related Tickets / Docs

- [../src/components/editor.md](../src/components/editor.md)
- [../prisma/schema.md](../prisma/schema.md)
