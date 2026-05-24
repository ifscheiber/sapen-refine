# API Error Contracts

## Purpose

RB-072 introduced shared API authentication, authorization, and domain failure helpers. RB-106 completes the protected-route convention so every protected `src/app/api/**/route.ts` handler is wrapped by `withApiErrorHandling`.

## Evidence

- `src/server/http/apiErrors.ts` owns the shared flat JSON error helpers.
- `src/proxy.ts` returns JSON `401` for unauthenticated `/api/**` requests while keeping browser page redirects for `/app/**`.
- Protected API route handlers use `withApiErrorHandling` for thrown auth/RBAC failures and `apiErrorFromPayload` for domain error mappers.
- `tests/unit/api-route-error-contracts.test.ts` inventories every API route and fails when protected route methods are not exported through `withApiErrorHandling`.
- `tests/unit/api-errors.test.ts`, `tests/unit/proxy-public-paths.test.ts`, and `tests/e2e/api-error-contracts.spec.ts` cover the response contract.

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

## Route Convention

Route authors must classify each new `src/app/api/**/route.ts` file in `tests/unit/api-route-error-contracts.test.ts`.

- `public-api` is reserved for `health`, `ready`, and auth login/logout/me endpoints.
- `protected-api` is the default for routes that require a session, project access, private storage access, mutation permissions, or domain-owned private data.
- Protected route methods must be exported as `export const METHOD = withApiErrorHandling(async function METHOD(...) { ... })`.
- Domain-specific failures should be converted with `apiErrorFromPayload(domainErrorResponse(error))`.
- Binary and download routes may return streamed `Response` objects on success, but their auth and domain failure paths must still return flat JSON before streaming starts.

The unit guard intentionally has no protected-route allowlist. If an exceptional route is ever needed, document the reason in the guard and adjacent API docs.

## Upload / Mask Errors

Current app-mediated upload and mask-save routes use stable flat JSON errors:

- `UPLOAD_TOO_LARGE` with `413` for bodies above app limits when the request reaches the app.
- `UNSUPPORTED_CONTENT_TYPE`, `IMAGE_DIMENSIONS_UNREADABLE`, `CHECKSUM_MISMATCH`, and `IMAGE_DIMENSIONS_UNSUPPORTED` for raw image upload validation.
- `WIDTH_REQUIRED`, `HEIGHT_REQUIRED`, `MASK_FORMAT_UNSUPPORTED`, `MASK_BYTE_LENGTH_MISMATCH`, `MASK_DIMENSIONS_MISMATCH`, and `SUPPORT_MASK_VALUES_INVALID` for current `u8raw-v1` mask validation.
- `BBOX_TOO_SMALL`, `BBOX_OUT_OF_BOUNDS`, `BBOX_VERSION_STALE`, `IMAGE_DIMENSIONS_REQUIRED`, and integer-field errors for RB-086 source-image BBox proposal validation.
- `CROP_PADDING_INVALID`, `CROP_SOURCE_IMAGE_UNSUPPORTED`, `CROP_IMAGE_GENERATION_FAILED`, `BBOX_DELETED`, `BBOX_VERSION_STALE`, and `CROP_NOT_FOUND` for RB-087 derived slice crop generation/read validation.

RB-081 keeps `MASK_BYTE_LENGTH_MISMATCH` public responses flat while audit details may include safe byte diagnostics. The diagnostic `x-mask-byte-length` header is never trusted for validation; the actual received request body length is the server source of truth.

## Related Tickets / Docs

- [auth-rbac-audit.md](auth-rbac-audit.md)
- [../src/app/api.md](../src/app/api.md)
- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
