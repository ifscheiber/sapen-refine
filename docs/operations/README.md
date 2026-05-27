# Operations

## Purpose

This folder documents local development, environment variables, and handoff hygiene.

## Important Files

- [local-development.md](local-development.md)
- [environment.md](environment.md)
- [ionos-resource-sizing.md](ionos-resource-sizing.md)
- [ionos-deployment-runbook.md](ionos-deployment-runbook.md)
- [handoff-zip-checklist.md](handoff-zip-checklist.md)
- [local-sapen-cnn-training-handoff.md](local-sapen-cnn-training-handoff.md)

## Public Interfaces / Routes / Functions

- `npm run dataset:materialize` runs the local SaPen-CNN dataset materializer documented in [local-sapen-cnn-training-handoff.md](local-sapen-cnn-training-handoff.md).
- The IONOS pilot runbook uses the trial Compose stack in [../../deploy/docker-compose.trial.yml](../../deploy/docker-compose.trial.yml) and the placeholder environment template in [../../deploy/trial.env.example](../../deploy/trial.env.example).

## Invariants And Constraints

- Do not commit real `.env` files or secrets.
- Handoff ZIPs should exclude ignored local artifacts and build caches.

## Known Gaps

- The IONOS runbook documents a single-host pilot deployment. Longer-term production still needs external/object-storage-backed media storage, off-host backup automation, monitoring, and a tested restore process.

## Related Tickets / Docs

- [../README.md](../README.md)
