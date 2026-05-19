# Editor Feature

The current editor is prototype-level but useful for drawing and saving masks.

Important files:

- `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx`
- `src/features/editor/EditImagePage.tsx`
- `src/features/editor/EditorClient.tsx`
- `src/mask/*`

Editor ownership is now under `src/features/editor` without a full editor rewrite.
