# DESIGN-014 — Remove Classification Tab from Annotation Editor

## Status

Done

## Type

Editor UI simplification ticket

## Repository / path context

Work in the `sapen-annotate` repository.

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only visual/layout/reference material. Do not import directly from `../sapen` at runtime unless the repository is intentionally configured for this.

## General boundary

Preserve existing storage contracts, API contracts, auth/RBAC behavior, editor canvas behavior, mask serialization, and Core handoff contracts unless the ticket explicitly asks for a small local UI-support addition.

Do not port SaPen Core logic wholesale into `sapen-annotate`.
Do not introduce CDN fonts/icons/Tailwind.
Do not add a new component library.


## Goal

Remove the local `Classification` tab from the Annotation Editor.

Classification is already determined by the user’s choice of annotation family. Therefore, a separate `Classification` tab is unnecessary and adds confusion.

## Product decision

The user classifies the slice/image by selecting the annotation family/workflow, e.g.:

- Sapwood / Heartwood semantic
- Cu / Support mask
- other existing family modes

Therefore:

```text
Classification tab = not needed
```

The classification state may still exist internally if required by existing API/contracts, but it should not be exposed as a separate local editor tab.

## Required reference inspection

Inspect current editor tab and classification handling:

```text
src/features/editor/CropSemanticEditorPage.tsx
src/features/editor/CropSemanticEditorClient.tsx
src/app/app/projects/[projectId]/images/[imageId]
src/lib/projectsClient.ts
```

Search for:

```text
Classification
classification
Save classification
slice classification
family
annotation family
```

Inspect SaPen Core Quick Analysis editor only as visual reference:

```text
../sapen/apps/sapen-core/src/features/quick-analysis
```

## Required changes

### 1. Remove local tab

Remove `Classification` from the local editor tab menu.

Remaining local editor tabs should be determined by the new simplified workflow. At minimum likely:

```text
BBoxes
Semantic Masks
Export Readiness
```

After DESIGN-015, `Support Mask` will also be removed, so Codex should avoid hard-coding assumptions that conflict with DESIGN-015.

### 2. Preserve internal classification logic if needed

If existing backend/API expects a classification field:

- keep internal mapping based on selected annotation family
- keep existing persisted data if necessary
- do not break export readiness
- do not remove storage/API fields unless explicitly safe

### 3. Remove explicit classification toolbar controls where now redundant

Remove or hide UI such as:

```text
Slice classification
No classification
Save classification
```

if classification is now derived from selected family.

If some state is still required to support legacy data, show it only as read-only metadata or handle it automatically.

### 4. Update readiness wording

Readiness/errors should no longer instruct the user to go to a `Classification` tab.

Instead use family-driven language, e.g.:

```text
Select an annotation family before export.
```

or:

```text
Annotation family missing.
```

## Acceptance criteria

- [ ] `Classification` tab is removed from editor local tabs.
- [ ] Classification is not presented as a separate user task.
- [ ] Existing family selection still works.
- [ ] Export/readiness logic still works.
- [ ] Any required internal classification field is preserved/derived.
- [ ] No API/storage contracts are broken.
- [ ] Tests/UI assertions referencing Classification tab are updated.

## Validation

Manual smoke checklist:

1. Open editor.
2. Verify no `Classification` local tab exists.
3. Select/change annotation family.
4. Annotate semantic mask.
5. Save/commit.
6. Verify export readiness still reflects family/annotation state correctly.
7. Verify no broken `Save classification` UI remains.

Run:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement DESIGN-014: Remove Classification Tab from Annotation Editor.

Product decision:
Classification is determined by the selected annotation family. A separate Classification tab is unnecessary.

Remove:
- Classification local tab
- explicit classification editing controls if now redundant
- Save classification UI where no longer needed

Preserve:
- any internal classification data required by existing API/contracts
- export readiness behavior
- annotation family selection
- storage contracts
- canvas/mask behavior

Update readiness messages/tests as needed.

Run validation and report:
A. UI removed
B. internal classification handling preserved/derived
C. tests updated
D. validation results
```

## Suggested commit message

```text
Remove redundant classification tab from editor
```
