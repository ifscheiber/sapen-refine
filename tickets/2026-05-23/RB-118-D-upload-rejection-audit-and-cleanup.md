# RB-118-D - Upload Rejection Audit And Cleanup

## Status

Planned

## Priority

P2 before public or broad untrusted upload exposure

## Type

Audit / Cleanup / Upload Safety

## Source

- `docs/08-adr/ADR-008-upload-content-safety.md`
- RB-118 follow-up

## Goal

Make upload rejection, quarantine expiry, and rejected-object cleanup auditable without exposing unsafe content or secrets.

## Requirements

- Add explicit rejected-upload audit actions and details policy.
- Extend cleanup/consistency reporting for quarantine/rejected objects as temporary candidates.
- Keep existing `cleanup.summary` and `cleanup.results` response fields backward-compatible.
- Ensure hard-drift exit policy is triggered only by protected committed-object missing/mismatch conditions.

## Acceptance Criteria

- Rejected upload audit rows include stable error codes, actor/project context, and safe sizes/checksums where useful.
- Cleanup removes expired quarantine/rejected objects within configured retention.
- Cleanup warnings for ordinary quarantine candidates do not cause non-zero hard-drift exits.
- Tests cover audit payload safety and cleanup response compatibility.
