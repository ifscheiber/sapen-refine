# Operations

## Purpose

This folder documents local development, environment variables, and handoff hygiene.

## Important Files

- [local-development.md](local-development.md)
- [environment.md](environment.md)
- [handoff-zip-checklist.md](handoff-zip-checklist.md)
- [local-sapen-cnn-training-handoff.md](local-sapen-cnn-training-handoff.md)

## Public Interfaces / Routes / Functions

- `npm run dataset:materialize` runs the local SaPen-CNN dataset materializer documented in [local-sapen-cnn-training-handoff.md](local-sapen-cnn-training-handoff.md).

## Invariants And Constraints

- Do not commit real `.env` files or secrets.
- Handoff ZIPs should exclude ignored local artifacts and build caches.

## Known Gaps

- Production deployment documentation is not written yet.

## Related Tickets / Docs

- [../README.md](../README.md)
