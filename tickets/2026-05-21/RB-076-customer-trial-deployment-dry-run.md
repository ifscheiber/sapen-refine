# RB-076 - Customer Trial Deployment Dry Run

## Status

Proposed / Future

## Priority

Medium

## Type

Operations / Deployment / Trial Readiness

## Context

RB-069 prepared the trial runbook and handoff gate, but the real Strato/customer deployment has not yet been executed.

Before real customer access, the deployment process should be rehearsed against the intended single-host Compose model.

## Goal

Perform and document a deployment dry run using the customer-trial runbook.

## Requirements

- Use the current trial Compose architecture: Caddy, app, PostgreSQL, MinIO, optional worker profile.
- Run `migrate deploy`, seed/create named trial users, and verify health/readiness.
- Verify upload, editor open, save, review/approve, export, backup, and restore outline.
- Record deviations from the runbook.
- Keep named-user trial access; do not expose shared demo credentials unless explicitly accepted.

## Non-Goals

- Do not execute the real iPad Safari gate unless deployment/device access is available.
- Do not add HA/replication/monitoring beyond documented trial assumptions.
- Do not add new product features.

## Acceptance Criteria

- The runbook can be followed from a clean host or equivalent dry-run environment.
- Trial user creation/reset steps are verified.
- Backup and restore commands are verified or explicitly blocked with reason.
- Any deployment findings are converted into follow-up tickets.

## Validation

- Trial Compose config check.
- Health/readiness checks.
- Manual deployment notes.

