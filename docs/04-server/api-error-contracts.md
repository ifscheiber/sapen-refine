# API Error Contracts

## Purpose

RB-072 standardizes representative API authentication, authorization, and domain failure responses for customer-trial browser and script callers.

## Evidence

- `src/server/http/apiErrors.ts` owns the shared flat JSON error helpers.
- `src/proxy.ts` returns JSON `401` for unauthenticated `/api/**` requests while keeping browser page redirects for `/app/**`.
- Representative API route handlers use `withApiErrorHandling` for thrown auth/RBAC failures and `apiErrorFromPayload` for domain error mappers.
- `tests/unit/api-errors.test.ts`, `tests/unit/proxy-public-paths.test.ts`, and `tests/e2e/api-error-contracts.spec.ts` cover the current contract.

## Error Shape

RB-072 uses the existing flat app convention:

```json
{
  "ok": false,
  "error": "UNAUTHENTICATED"
}
```

Successful response shapes are unchanged.

## Common Status Codes

- `401 UNAUTHENTICATED` for missing or invalid API sessions.
- `403 FORBIDDEN` or a domain-specific forbidden code such as `CLEANUP_FORBIDDEN`.
- `404 *_NOT_FOUND` for missing resources that are safe to report.
- `409` for conflict-like domain states such as invalid review transitions or export-not-ready decisions.
- `400` for current validation failures unless a route already has a more specific status.
- `500 INTERNAL_ERROR` only as a sanitized fallback for unknown uncaught exceptions.

Legacy route/domain code may still internally use `UNAUTHORIZED`; API response helpers normalize that to `UNAUTHENTICATED`.

## Proxy Interaction

The same-origin mutation guard runs before session checks. Cross-site unsafe API mutations are rejected as:

```json
{
  "ok": false,
  "error": "CROSS_SITE_MUTATION_REJECTED"
}
```

Unauthenticated API requests return JSON `401`. Unauthenticated workspace page requests continue to redirect to `/login?next=...`.

RB-079 keeps that split for stale or invalid session cookies. `src/proxy.ts` forwards the requested `/app/**` path to the workspace layout through an internal request header, and the layout redirects to login when `getUserFromSessionCookie()` cannot resolve a valid DB session.

## Current Coverage

RB-072 applies the shared helper to representative high-risk route families:

- project list/create/update;
- project image list/upload;
- image metadata, asset, and latest-mask reads;
- review transitions;
- training export creation/download;
- model/prediction provenance reads and creates;
- prediction mask import;
- prediction batch process/retry/process-due;
- correction task detail/update;
- storage cleanup.

Some lower-risk or compatibility routes still return the older flat string form directly. They remain acceptable when they already return JSON and stable codes; broader migration can be handled incrementally.

## Upload / Mask Errors

Current app-mediated upload and mask-save routes use stable flat JSON errors:

- `UPLOAD_TOO_LARGE` with `413` for bodies above app limits when the request reaches the app.
- `UNSUPPORTED_CONTENT_TYPE`, `IMAGE_DIMENSIONS_UNREADABLE`, `CHECKSUM_MISMATCH`, and `IMAGE_DIMENSIONS_UNSUPPORTED` for raw image upload validation.
- `WIDTH_REQUIRED`, `HEIGHT_REQUIRED`, `MASK_FORMAT_UNSUPPORTED`, `MASK_BYTE_LENGTH_MISMATCH`, `MASK_DIMENSIONS_MISMATCH`, and `SUPPORT_MASK_VALUES_INVALID` for current `u8raw-v1` mask validation.

RB-081 keeps `MASK_BYTE_LENGTH_MISMATCH` public responses flat while audit details may include safe byte diagnostics. The diagnostic `x-mask-byte-length` header is never trusted for validation; the actual received request body length is the server source of truth.

## Related Tickets / Docs

- [auth-rbac-audit.md](auth-rbac-audit.md)
- [../src/app/api.md](../src/app/api.md)
- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
