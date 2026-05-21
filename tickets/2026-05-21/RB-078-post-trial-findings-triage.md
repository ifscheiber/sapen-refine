# RB-078 - Post-Trial Findings / Triage

## Status

Proposed / Future

## Priority

Medium

## Type

Product Triage / Trial Feedback / Planning

## Context

After customer-trial deployment and initial iPad/desktop use, the repo needs a structured triage pass before starting larger product features.

Likely topics include editor ergonomics, review workflow, export history, audit visibility, cleanup operations, multi-slice support, and prediction-analysis dashboards.

## Goal

Convert real trial findings into a prioritized implementation backlog.

## Requirements

- Review customer/operator feedback, logs, failed smoke steps, and open backlog items.
- Separate bugs, customer-trial blockers, UX improvements, and larger product features.
- Preserve ground-truth integrity and attribution as the priority when ranking work.
- Create focused tickets for the next implementation sequence.
- Update known-gaps and remediation backlog.

## Non-Goals

- Do not implement fixes directly inside the triage ticket unless they are documentation-only corrections.
- Do not start large features without a scoped ticket.
- Do not merge SaPen Core integration assumptions into Annotate without ADR coverage.

## Acceptance Criteria

- Trial findings are categorized and prioritized.
- Next implementation tickets are ready for review.
- Deferred items remain documented in the backlog.

## Validation

- Documentation review.
- Ticket consistency check.

