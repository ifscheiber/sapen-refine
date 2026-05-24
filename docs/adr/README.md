# ADR And Backlog Index

## Purpose

This folder is the operational ADR/backlog entry point used by AGENTS.md. Numbered current ADRs live under `docs/08-adr/`; older historical decisions may remain under `docs/architecture/decisions/`. Do not move ADR files between these folders as drive-by cleanup.

## Important Files

- [remediation-backlog.md](remediation-backlog.md) - deferred architecture and validation debt.
- [../architecture/decisions/ADR-0001-sapen-annotate-naming.md](../architecture/decisions/ADR-0001-sapen-annotate-naming.md) - naming decision.
- [../08-adr/ADR-002-desktop-browser-first-ipad-deferred.md](../08-adr/ADR-002-desktop-browser-first-ipad-deferred.md) - desktop-first implementation with real iPad Safari deferred gate.
- [../08-adr/ADR-003-annotation-domain-model.md](../08-adr/ADR-003-annotation-domain-model.md) - annotation domain model decision.
- [../08-adr/ADR-004-model-preprediction-active-learning.md](../08-adr/ADR-004-model-preprediction-active-learning.md) - model preprediction and active-learning design decision.
- [../08-adr/ADR-005-crop-based-slice-annotation.md](../08-adr/ADR-005-crop-based-slice-annotation.md) - crop-based slice annotation design decision.
- [../08-adr/ADR-006-crop-workflow-ux-orchestration.md](../08-adr/ADR-006-crop-workflow-ux-orchestration.md) - crop workflow UX route/state orchestration decision.
- [../08-adr/ADR-007-system-actor-attribution-model.md](../08-adr/ADR-007-system-actor-attribution-model.md) - system actor, operator, processor, and external-system attribution model.
- [../08-adr/ADR-008-upload-content-safety.md](../08-adr/ADR-008-upload-content-safety.md) - upload integrity/content-safety trust-boundary decision.

## Public Interfaces / Routes / Functions

Not applicable.

## Invariants And Constraints

- Backlog entries must include context, impact, proposed next step or resolution, affected modules, owner, and priority.
- ADRs must document decisions, not speculative implementation detail.
- The annotation domain ADR is implemented as a design gate first; schema implementation belongs to follow-up tickets.
- Review-derived implementation tickets live under `tickets/2026-05-23/`; active/done links are indexed by that folder's README.

## Known Gaps

ADR files currently live in both `docs/architecture/decisions/` and `docs/08-adr/` from earlier documentation slices. This folder is the canonical short index and backlog entry point expected by AGENTS.md.

## Related Tickets / Docs

- [../README.md](../README.md)
