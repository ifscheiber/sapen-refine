# RB-073 - Trial Deployment Secret & Build-Context Hygiene

## Status

Proposed / Ready for Planning

## Priority

High

## Type

Deployment / Security / Customer Trial Readiness

## Context

The deep review found two concrete deployment hygiene gaps:

- `.dockerignore` does not exclude several generated local artifacts such as Playwright reports, test results, backups, archives, caches, and build outputs.
- `deploy/docker-compose.trial.yml` interpolates MinIO credentials in the `minio-init` command, which can expose real values in rendered Compose config or process metadata.

## Goal

Harden the customer-trial Docker/Compose baseline so local artifacts and secrets are less likely to leak during build or operations.

## Requirements

- Align `.dockerignore` with handoff archive exclusions where appropriate.
- Avoid rendering MinIO credentials directly into Compose command output.
- Keep MinIO S3 and console endpoints private unless explicitly required.
- Update the trial deployment runbook with the corrected secret/build-context guidance.
- Add or update a Compose config smoke validation if useful.

## Non-Goals

- Do not deploy to Strato in this ticket.
- Do not add high availability, object replication, or production monitoring.
- Do not move to an external secret manager.
- Do not expose MinIO publicly.

## Acceptance Criteria

- Docker build context excludes expected generated/private artifacts.
- Compose config no longer renders MinIO access credentials in the init command.
- Trial docs explain the remaining single-host assumptions and backup responsibility.
- Validation includes a trial Compose config check.

## Validation

- `docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config`
- `npm run lint`
- `npm run typecheck`

