# FEAT-021 — Image-Level Submission and Review Workflow

## Status

Done

## Type

Workflow / editor UX / review-state semantics ticket

## Target repository

Work in the `sapen-annotate` repository.

## Reference repository path

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only reference. Do not import directly from `../sapen` at runtime unless the repository is intentionally configured for this.

## Background

The current Annotation Editor still exposes mask-level review actions similar to:

```text
Sap/Heartwood: Draft v1   Submit   Approve   Reject
Classification: Draft v1  Submit   Approve   Reject
Review comment
```

This is no longer the desired workflow.

The user should not submit individual masks separately.

A mask should be saved automatically after drawing operations, e.g.:

- after polygon close/apply
- after lasso apply
- after brush stroke debounce/end
- after Background clear operation
- after support mask apply/replace

The thing that is submitted for review is the **entire image annotation state**, not each individual mask.

Review actions (`Approve`, `Reject`) must only be available to users with reviewer/owner/expert permissions, and only after the whole image has been submitted.

## Goal

Replace mask-level submit/approve/reject controls with an image-level submission and review workflow.

The editor should support this conceptual lifecycle:

```text
Editing image annotations
→ masks autosave/draft-save as the user edits
→ submit entire image for review
→ reviewer/owner/expert approves or rejects entire image annotation
```

Individual mask versions may still exist internally, but the user-facing review workflow must be image-level.

## Product decision

### Masks are auto-saved / draft-saved

Masks should not need individual user submission.

After the user changes a mask, the system should save the draft/current mask state automatically using the existing debounce/commit/autosave mechanism where available.

Expected save triggers:

- polygon close/apply
- polygon re-edit apply
- lasso apply
- brush stroke end/debounce
- Background label apply
- support mask apply/replace
- undo/redo if it changes current draft state
- explicit save/commit action if still needed by current architecture

### Submission is image-level

The user submits the whole image annotation state, not individual masks.

Image-level submission includes the relevant current/draft state of:

- BBoxes / slice work areas
- semantic mask(s)
- support mask(s), where required
- annotation family
- export/readiness state
- any required image metadata

### Review is image-level

Approval/rejection applies to the submitted image annotation state as a whole.

`Approve` and `Reject` should not be shown for individual masks.

`Approve`/`Reject` should only be available:

- after the image has been submitted
- to users with reviewer/owner/expert permissions
- according to existing role/RBAC model

### Role expectations

Do not invent a new role model. Inspect existing roles/permissions first.

Conceptual product behavior:

- `Labeler`
  - can edit annotations
  - can submit the whole image
  - cannot approve/reject
- `Reviewer` / `Expert`
  - can review submitted images
  - can approve/reject
- `Owner`
  - can edit and submit
  - may approve/reject, if the existing product/RBAC model allows owner review

If the current role model does not yet distinguish these fully, implement the UI according to the existing safest permission checks and document follow-up.

## Required reference inspection

Inspect local editor/review/versioning code:

```text
src/features/editor/CropSemanticEditorClient.tsx
src/features/editor/CropSemanticEditorPage.tsx
src/features/editor
src/app/app/projects/[projectId]/images/[imageId]
src/app/api
src/lib/projectsClient.ts
src/lib
```

Search local repo for:

```text
Submit
Approve
Reject
Review comment
review
submitted
approved
rejected
draft
mask version
MaskVersion
classification
canApprove
canSubmit
role
OWNER
Labeler
Reviewer
Expert
autosave
debounce
commit
```

Inspect SaPen Core / Refine only as read-only reference for review-state patterns:

```text
../sapen/apps/sapen-core/src/features
../sapen/apps/sapen-refine/src/app
../sapen/apps/sapen-refine/src/lib
```

Search reference repo for:

```text
submit
approve
reject
review
review comment
mask version
draft
submitted
approved
```

## Required UI changes

### 1. Remove mask-level review row

Remove the UI row shown in the screenshot or equivalent controls:

```text
Sap/Heartwood: Draft v1   Submit   Approve   Reject
Classification: Draft v1  Submit   Approve   Reject
Review comment
```

Do not show `Submit`, `Approve`, or `Reject` for individual masks.

### 2. Add image-level submission/review area

Replace the mask-level row with a compact image-level review/status area.

Possible compact placement:

- editor header context row
- slim status strip below tabs
- right-side review panel
- footer/status bar if existing

Suggested states:

#### Editing / draft

```text
IMAGE REVIEW
Draft · unsent
[Submit image]
```

#### Submitted

```text
IMAGE REVIEW
Submitted · awaiting review
```

Reviewer/owner/expert sees:

```text
[Approve image] [Reject image] [Review comment]
```

Labeler sees:

```text
Submitted · awaiting review
```

#### Approved

```text
IMAGE REVIEW
Approved by {user} · {relative time}
```

#### Rejected

```text
IMAGE REVIEW
Rejected by {user} · {relative time}
Review comment: ...
[Resubmit image]
```

Keep this compact. Do not create a large panel unless the existing workspace has a review rail.

### 3. Review comment is image-level

The `Review comment` input must belong to image-level reject/review flow, not individual masks.

- It should be visible/enabled only when rejecting or reviewing submitted image state.
- It should not be always visible as a toolbar input if there is no submitted image to review.
- It should not be duplicated per mask.

### 4. Submit image action

Provide one clear action:

```text
Submit image
```

or compact icon action with tooltip:

```text
Submit annotation for review
```

This action should submit the entire image annotation state.

Before enabling submit, the editor should respect readiness/validation checks:

- required BBoxes exist
- semantic mask requirements satisfied
- support mask requirements satisfied for Cu family
- no BBox overlap issues
- required image metadata exists if applicable
- no blocking export/readiness issues

If validation fails, disable submit and show compact reason(s).

### 5. Approve/reject visibility

Approve/reject controls must be hidden or disabled unless:

- image state is submitted
- current user has permission to review
- required submitted payload/state exists

Do not show disabled `Approve`/`Reject` buttons to labelers if that adds noise. Prefer hiding or showing read-only submitted status.

### 6. Autosave/draft save status

Because masks are no longer individually submitted, the editor should communicate save state separately.

Examples:

```text
Saved just now
Unsaved changes…
Saving…
Save failed
```

This is not a review action; it is a draft persistence status.

Use existing autosave/debounce/commit status if available.

## Required workflow behavior

### Mask changes

Mask changes should update the draft/current image annotation state.

No individual mask submission required.

### Image submission

When the user submits the image:

- include/lock/reference the current relevant draft mask versions
- mark the image annotation state as submitted
- preserve traceability of what was submitted
- ensure later edits invalidate or require resubmission according to existing product semantics

If the exact image-level submission backend does not yet exist:

- remove misleading mask-level submission UI
- add a small image-level submit facade only if it can call an existing endpoint safely
- otherwise document backend follow-up
- do not fake submission state in production

### Post-submission edits

If user edits after submitting:

- submitted state should become outdated or return to draft, depending on existing semantics
- approval should not apply to changed, unsubmitted edits
- if current backend lacks this concept, document follow-up

## Functional boundaries

Do not change:

- mask storage format
- label IDs
- BBox storage
- Core handoff contracts
- export format
- auth/RBAC model unless using existing permission helpers
- project/image upload contracts

Do not invent:

- new role model
- fake review backend
- per-mask review semantics
- broad schema migration unless explicitly necessary and approved

## Acceptance criteria

### UI

- [ ] Mask-level `Submit`, `Approve`, and `Reject` controls are removed.
- [ ] Classification-level `Submit`, `Approve`, and `Reject` controls are removed.
- [ ] `Review comment` is no longer shown as a generic mask-level toolbar input.
- [ ] One image-level submit/review status area exists.
- [ ] Submit action clearly applies to the whole image.
- [ ] Approve/reject actions clearly apply to the whole image.
- [ ] UI remains compact and does not waste vertical space.

### Workflow

- [ ] Mask edits are saved/draft-saved without individual submission.
- [ ] Image-level submit uses current annotation state.
- [ ] Submit is blocked/disabled when readiness validation fails.
- [ ] Approve/reject is available only after image submission.
- [ ] Approve/reject is available only to users with reviewer/owner/expert permission.
- [ ] Labeler cannot approve/reject.
- [ ] Review comment belongs to image-level reject/review.

### Regression

- [ ] Semantic mask editing still works.
- [ ] Support mask editing still works.
- [ ] BBox editing still works.
- [ ] Autosave/debounce save still works.
- [ ] Export/readiness still works.
- [ ] Existing API contracts are preserved unless documented.

## Validation

Run repo-appropriate checks from `sapen-annotate`.

At minimum attempt:

```bash
npm run typecheck
npm run lint
npm run build
```

Run tests if relevant and feasible:

```bash
npm test
```

Recommended tests:

- mask-level submit controls are not rendered
- labeler sees submit image but not approve/reject
- reviewer/owner sees approve/reject only after submitted state
- submit disabled when readiness blockers exist
- image-level review comment used for rejection
- autosave still called after polygon close/brush debounce

Manual smoke checklist:

1. Open editor as labeler.
2. Draw semantic mask.
3. Verify there is no mask-level Submit button.
4. Verify draft/save status updates after edit.
5. Verify image-level Submit image action exists.
6. Try to submit with readiness blockers and verify it is blocked.
7. Complete required annotations and submit image.
8. Verify no Approve/Reject controls for labeler.
9. Open as reviewer/owner/expert.
10. Verify Approve/Reject appears only for submitted image.
11. Reject with review comment.
12. Verify rejected state is image-level.
13. Edit after rejection/resubmit if supported.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement FEAT-021: Image-Level Submission and Review Workflow.

Problem:
The editor currently shows mask-level review controls like:
Sap/Heartwood: Draft v1 Submit Approve Reject
Classification: Draft v1 Submit Approve Reject
Review comment

This is no longer desired.

Product decision:
- Masks are not submitted individually.
- Masks are saved/draft-saved automatically after drawing/debounce/closing.
- The whole image annotation state is submitted for review.
- Approve/Reject applies only to the submitted whole image.
- Approve/Reject is only available to Reviewer/Owner/Expert according to existing role model.
- Labeler can submit but cannot approve/reject.

Required:
1. Remove mask-level Submit/Approve/Reject UI.
2. Remove classification-level Submit/Approve/Reject UI.
3. Move Review comment into image-level review/reject flow.
4. Add or adapt compact image-level Submit image / review status area.
5. Preserve existing autosave/debounce/commit behavior for masks.
6. Ensure submit is blocked by readiness issues.
7. Ensure Approve/Reject only appears for submitted image state and permitted roles.
8. Do not invent fake backend review state; use existing endpoints/model if available and document follow-up otherwise.

Inspect local role/review/mask version code first.

Do not change:
- mask storage format
- label IDs
- BBox storage
- Core handoff contracts
- auth/RBAC model except using existing permission helpers
- project/image upload contracts

Run:
- npm run typecheck
- npm run lint
- npm run build
- npm test if appropriate

Report:
A. What changed
B. Files changed
C. How mask autosave/draft save is preserved
D. How image-level submit works or what backend follow-up is needed
E. How role-based approve/reject visibility works
F. Validation results
G. Follow-ups
```

## Suggested commit message

```text
Replace mask-level review controls with image submission
```
