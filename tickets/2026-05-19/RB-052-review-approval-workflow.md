# RB-052 - Review And Approval Workflow

## Status

Proposed

## Priority

High

## Type

Workflow / Authorization / Ground Truth

## Depends on

- RB-049 - Annotation Domain Schema Implementation

## Goal

Implement review and approval as a core ground-truth workflow.

## Scope

- Support artifact states `draft`, `submitted`, `approved`, `rejected`, and `superseded`.
- Add server-side authorization for annotate, review, and approval actions.
- Persist reviewer attribution, timestamps, comments, and decision history.
- Keep approved artifact versions immutable and exportable by exact version id.
- Update docs and add focused route/domain tests.

## Non-Goals

- Full export implementation.
- Active-learning queue implementation.
- Complex reviewer dashboard beyond the minimum usable workflow.

## Acceptance Criteria

- Annotators can submit work for review.
- Reviewers can approve, reject, and supersede submitted work.
- Unauthorized users cannot review/approve server-side.
- Approved versions remain append-only and attributable.
- Validation baseline remains green.
