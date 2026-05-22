# RB-084 - Docker Prisma OpenSSL Runtime Warning

## Status

Proposed / Follow-up

## Priority

Medium

## Type

Deployment / Docker / Prisma Runtime Hygiene

## Context

RB-076 local trial deployment dry run built and ran the Compose app/migrate images successfully, but Prisma emitted warnings inside the `node:22-bookworm-slim` image:

```text
Prisma failed to detect the libssl/openssl version to use, and may not work as expected.
Defaulting to "openssl-1.1.x".
```

The warning appeared during Docker image build and during the `migrate` one-shot service. The commands passed, but a customer-trial image should not rely on Prisma fallback detection.

## Goal

Install the required OpenSSL runtime dependency in the Docker image stages used for Prisma generation, migrations, and runtime scripts so Prisma no longer emits OpenSSL detection warnings.

## Non-Goals

- Do not change Prisma versions.
- Do not run `npm audit fix --force`.
- Do not change Compose topology.
- Do not add unrelated image optimization work.

## Acceptance Criteria

- Docker build completes without Prisma OpenSSL detection warnings.
- `docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml build` passes.
- `docker compose --env-file <dry-run-env> -f deploy/docker-compose.trial.yml --profile tools run --rm migrate` passes without the warning.
- `npm run build`, `npm run test`, and relevant deployment-hygiene tests pass.
- Deployment docs are updated only if the required Docker package/runtime assumption changes.
