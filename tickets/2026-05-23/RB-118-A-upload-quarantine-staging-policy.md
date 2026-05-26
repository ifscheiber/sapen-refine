# RB-118-A - Upload Quarantine Staging Policy

## Status

Planned

## Priority

P2 before public or broad untrusted upload exposure

## Type

Security / Storage / Upload Pipeline

## Source

- `docs/08-adr/ADR-008-upload-content-safety.md`
- RB-118 follow-up

## Goal

Introduce a private quarantine/staging policy for newly received upload bytes so untrusted content is separated from durable training artifacts until safety checks pass.

## Requirements

- Define quarantine prefixes, metadata, retention, and promotion rules for raw images and future staged uploads.
- Ensure durable DB rows are created only after promotion or explicitly marked as quarantine-only records.
- Preserve existing app-mediated upload integrity checks and stable API errors.
- Document how quarantine objects interact with RB-114 storage cleanup/consistency reporting.

## Acceptance Criteria

- New uploads can be represented as quarantine/staged objects before durable commit.
- Promotion to committed storage keys is explicit and auditable.
- Ordinary quarantine cleanup candidates are warnings/findings only, not hard drift.
- Protected committed object drift remains hard drift.
