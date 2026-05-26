# RB-118-E - Reverse Proxy Upload Limit Alignment

## Status

Planned

## Priority

P2 before public or broad untrusted upload exposure

## Type

Operations / Deployment / Upload Safety

## Source

- `docs/08-adr/ADR-008-upload-content-safety.md`
- RB-118 follow-up

## Goal

Align app, Next proxy, Caddy, and future scanner/quarantine upload limits so rejected uploads fail predictably and safely.

## Requirements

- Document and test limit precedence across `IMAGE_UPLOAD_MAX_BYTES`, `MASK_UPLOAD_MAX_BYTES`, `PREDICTION_BATCH_UPLOAD_MAX_BYTES`, `NEXT_PROXY_CLIENT_MAX_BODY_SIZE`, `CADDY_MAX_BODY_SIZE`, and scanner/quarantine limits.
- Keep proxy limits high enough for app-level JSON errors where practical.
- Define behavior when Caddy or Next rejects first.
- Update deployment templates and runbooks with public-exposure guidance.

## Acceptance Criteria

- Deployment docs clearly identify every upload/body limit that must move together.
- Public-exposure docs require scanner/quarantine limits to be reviewed with app/proxy limits.
- Existing trial defaults remain unchanged unless the implementation ticket explicitly changes them.
- Tests or static checks cover template/runbook alignment where practical.
