# RB-081 — Hotfix: Mask Upload Byte-Length Mismatch Follow-up

## Status

Proposed / Ready for Codex

## Priority

Critical / Hotfix

## Type

Editor / Mask Upload / Server Body Handling / Full-Resolution Reliability / Tests

## Context

RB-080 hardened the client-side editor mask upload path, but manual browser testing still fails with:

```text
UPLOAD_FAILED 400: {"ok":false,"error":"MASK_BYTE_LENGTH_MISMATCH"}
```

The error occurs in both Firefox and Chrome.

For the known image `T 6572.JPG`:

```text
width = 6000
height = 4000
expected mask bytes = 24,000,000
```

The server is correct to reject requests where:

```text
actual received bytes !== width * height
```

RB-081 must therefore find and fix the remaining end-to-end mismatch without weakening server validation.

Follow-up investigation found audit rows where the client diagnostic declared `24,000,000` bytes while the server received only about `10.4 MB`. That matches the Next.js proxy default client-body limit. Because `src/proxy.ts` covers API mutation requests, the fix must configure Next proxy buffering as well as app/Caddy upload limits.

RB-081 also documents the trial full-resolution policy:

- `<= 6000x4000` / `24,000,000` pixels: normal trial editing path.
- `> 6000x4000` up to `8000x6000` / `48,000,000` pixels: supported with large-image memory warning.
- Above `8000x6000`, above `48,000,000` pixels, or beyond long edge `8000` / short edge `6000`: unsupported for trial annotation.

Memory planning must account for browser-side decoded image memory plus multiple mask/working layers. At `8000x6000`, one `u8raw-v1` mask is `48,000,000` bytes and a decoded RGBA image is about 192 MB. Real iPad Safari remains a manual device gate.

---

## Goal

Make real full-resolution mask saves succeed for the 6000×4000 case while keeping strict raw `u8raw-v1` validation.

At the end of RB-081:

1. Server-side mask upload routes read raw request bytes safely.
2. Semantic, support and assisted-correction upload paths share the same raw body validation.
3. A 6000×4000 / 24,000,000-byte upload is covered by a real route/integration test.
4. Truncated bodies still fail with `MASK_BYTE_LENGTH_MISMATCH`.
5. Diagnostics are safe and useful.
6. No tiling, downscaling or server validation weakening is introduced.

---

## Non-Goals

Do **not** implement:

- tiling,
- downscaled working masks,
- sparse/patch uploads,
- new mask format,
- weakened byte-length validation,
- public diagnostic payloads containing private data,
- broad editor rewrite,
- schema/API semantics changes,
- review/export behavior changes.
- hard multi-tab blocking.

Multiple editor tabs should be warned about later, not blocked in this hotfix. RB-083 tracks an edit-session / soft-lock / multi-tab warning follow-up.

---

## Required Baseline

Start with:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

---

## Investigation Tasks

Inspect semantic/support/correction mask upload routes for unsafe binary handling:

```text
request.text()
request.formData()
Blob.text()
TextEncoder/TextDecoder roundtrip
Buffer.from(string)
JSON transport for raw mask bytes
body stream read twice
```

For raw `u8raw-v1`, server code must read the request as raw bytes, for example:

```ts
const bytes = new Uint8Array(await request.arrayBuffer())
```

or an equivalent raw-byte-safe path.

---

## Implementation Scope

### 1. Central raw mask request reader

Add or consolidate a server helper for mask upload requests.

Implemented location:

```text
src/server/uploads/maskRequest.ts
```

The helper must:

- read body exactly once as raw bytes,
- compute `receivedBytes`,
- parse `x-mask-width`,
- parse `x-mask-height`,
- parse `x-mask-format`,
- parse optional diagnostic `x-mask-byte-length`,
- compute `expectedBytes = width * height`,
- reject mismatch with `MASK_BYTE_LENGTH_MISMATCH`,
- pass raw bytes to existing mask validation helpers.

### 2. Apply to all upload paths

Use the helper for:

```text
semantic mask upload
support mask upload
assisted-correction mask upload
```

Do not keep separate byte-length logic per route.

### 3. Preserve strict validation

`x-mask-byte-length` is diagnostic only.

The server source of truth is:

```text
actual receivedBytes === width * height
```

### 4. Safe diagnostics

For `MASK_BYTE_LENGTH_MISMATCH`, record safe diagnostics in audit/log details:

```text
expectedBytes
receivedBytes
declaredClientBytes
contentLengthHeader
width
height
format
route/mode
imageId if safe
artifact kind if safe
```

Do not log:

```text
payload bytes
private storage keys
credentials
private URLs
session tokens
```

The public JSON response may remain flat:

```json
{"ok":false,"error":"MASK_BYTE_LENGTH_MISMATCH"}
```

### 5. Real large-body test

Add a non-mocked route/integration test that sends a real 24,000,000-byte body through the relevant server path and verifies it is not rejected for byte-length mismatch.

If full persistence is too heavy, test the raw reader plus a representative route boundary. Do not rely only on Playwright request interception.

### 6. Next proxy body limit

Configure:

```text
NEXT_PROXY_CLIENT_MAX_BODY_SIZE=120mb
```

This must be wired through `next.config.ts`, `Dockerfile`, `deploy/docker-compose.trial.yml`, and `deploy/trial.env.example`. The value must stay above `MASK_UPLOAD_MAX_BYTES`.

### 7. Trial full-resolution image policy

Implement/document:

- `6000x4000`: normal.
- `8000x6000`: accepted with warning.
- larger than trial policy: reject new uploads with `IMAGE_DIMENSIONS_UNSUPPORTED` and block editor entry for existing oversized rows.

---

## Tests

Add/extend tests for:

- raw reader accepts 6000×4000 / 24,000,000 bytes,
- raw reader rejects truncated body,
- semantic upload path uses raw reader,
- support upload path uses raw reader,
- correction upload path uses raw reader,
- public response remains stable,
- diagnostics are safe,
- RB-080 client helper tests remain green.

---

## Documentation Updates

Update:

```text
docs/03-features/editor.md
docs/03-features/images.md
docs/06-data/mask-and-artifact-versioning.md
docs/04-server/api-error-contracts.md
docs/04-server/runtime-config.md
docs/04-server/deployment-trial.md
docs/known-gaps.md
docs/adr/remediation-backlog.md
```

Docs must state:

- mask uploads are raw `u8raw-v1`,
- server reads raw bytes,
- no MSK1 header in current editor upload body,
- `x-mask-byte-length` is diagnostic only,
- full-resolution 6000×4000 masks are supported,
- tiling/downscaled masks remain deferred unless still needed.

---

## Acceptance Criteria

1. `git status --short` is clean.
2. Server mask upload code uses raw-byte body reading.
3. No relevant route relies on string conversion for raw mask bytes.
4. 6000×4000 / 24,000,000-byte server-side test passes.
5. Truncated body still fails with `MASK_BYTE_LENGTH_MISMATCH`.
6. Diagnostics are safe and useful.
7. Public error response remains stable.
8. No tiling/downscaling/new format is introduced.
9. Ticket is moved to `tickets/2026-05-21/done/`.
10. Full validation gate passes.
