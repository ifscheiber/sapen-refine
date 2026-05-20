# RB-066 - Batch And Staging Storage Retention Cleanup

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Storage / Operations / Cleanup / Prediction Import / Upload Hygiene / Tests

## Depends on

- RB-061 - Batch Prediction Import and Background Job Baseline
- RB-062 - Repository State and Documentation Consistency Sweep

## Goal

Define and implement retention/cleanup rules for staged prediction batch files and related orphan object risks.

Current risks:

- RB-061 stages ZIP item files in private object storage.
- Failed or completed batches can leave source files indefinitely.
- Presigned compatibility routes can leave orphan objects if clients upload but never commit.
- Operators do not yet have a clear purge or retention runbook.

## Non-Goals

- Do not delete raw images, approved mask versions, export packages, or historical training artifacts.
- Do not change prediction-import validation.
- Do not remove presigned compatibility routes unless the ticket explicitly documents and validates that decision.
- Do not implement cloud-provider lifecycle policies that are unavailable in local MinIO.

## Required Baseline

Run before editing:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
```

## Implementation Notes

- Decide and document retention durations for batch staging objects.
- Add safe cleanup tooling or APIs for staged batch source objects.
- Add manual purge documentation for MinIO-backed trial deployments.
- Document the current presigned compatibility routes and decide whether to keep, feature-flag, or remove them in a later slice.
- Ensure cleanup is auditable and never touches committed raw image or artifact-version objects.

## Acceptance Criteria

- Staging cleanup behavior is implemented or explicitly documented with copy-paste commands.
- Retention policy is visible in operations docs.
- Tests cover cleanup selection and non-deletion of committed artifacts.
- Known residual orphan risks are recorded in the remediation backlog.
- Ticket is moved to `tickets/2026-05-20/done/` after completion.

