# RB-118 - Upload Content Safety Hardening Design

## Status

Planned

## Priority

P3 internal, P2 before public upload exposure

## Type

Security Design / Upload Safety / Operations

## Source

- `tickets/2026-05-23/sapen_annotate_deep_review_report_chatGPT.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`

## Depends On

- Current upload integrity validation from RB-055.
- Deployment exposure decision.

## Blocks

- Public or internet-exposed upload posture.

## Context

The upload path validates content type, byte dimensions, checksum, size, and object metadata. That is integrity validation, not malware scanning or full content safety. For internal/trial deployment this may be acceptable. For public exposure it needs a stronger content-safety design.

## Goal

Define a production upload content safety approach before broader/public upload exposure.

## Non-Goals

- Do not implement scanning in this design-only ticket unless explicitly rescheduled.
- Do not add support for new image formats.
- Do not weaken existing upload validation.

## Requirements

- Document the current upload trust boundary.
- Evaluate malware scanning, controlled decode/re-encode, EXIF/metadata stripping, sandboxed processing, and reverse-proxy body limits.
- Identify where scanning fits relative to object storage and DB commit.
- Define failure modes and stable user-facing errors.
- Decide whether trial deployment can continue with current validation plus authenticated access.
- Create implementation tickets if scanning/re-encoding is required.

## Acceptance Criteria

- A clear design doc or ADR exists for upload content safety.
- Public exposure prerequisites are explicit.
- Current trial posture is either accepted with rationale or given required fixes.
- No secret or uploaded file content is logged in the design.

## Validation

Run:

```bash
git status --short
git diff --check
npm run lint
```
