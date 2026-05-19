# ADR And Backlog Index

## Purpose

This folder is the operational ADR/backlog entry point used by AGENTS.md.

## Important Files

- [remediation-backlog.md](remediation-backlog.md) - deferred architecture and validation debt.
- [../architecture/decisions/ADR-0001-sapen-annotate-naming.md](../architecture/decisions/ADR-0001-sapen-annotate-naming.md) - naming decision.
- [../08-adr/ADR-003-annotation-domain-model.md](../08-adr/ADR-003-annotation-domain-model.md) - annotation domain model decision.

## Public Interfaces / Routes / Functions

Not applicable.

## Invariants And Constraints

- Backlog entries must include context, impact, proposed next step, affected modules, owner, and priority.
- ADRs must document decisions, not speculative implementation detail.
- The annotation domain ADR is implemented as a design gate first; schema implementation belongs to follow-up tickets.

## Known Gaps

The ADR files currently live under `docs/architecture/decisions/`; this folder remains as the shorter index expected by AGENTS.md.

## Related Tickets / Docs

- [../README.md](../README.md)
