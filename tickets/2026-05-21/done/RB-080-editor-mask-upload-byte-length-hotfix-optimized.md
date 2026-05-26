# RB-080 — Hotfix: Editor Mask Upload Byte-Length Mismatch

## Status

Proposed / Ready for Codex

## Priority

Critical / Hotfix

## Type

Editor / Mask Upload / Full-Resolution Annotation / Client Payload / Server Diagnostics / Tests

## Repository

`sapen-annotate`

## Context

A current full-resolution image (`T 6572.JPG`, 6000×4000) triggers a mask upload byte-length mismatch during editor save.

The server correctly rejects mask uploads when:

```text
receivedBytes !== x-mask-width * x-mask-height
```

For a 6000×4000 image, the expected mask byte length is:

```text
6000 * 4000 = 24,000,000 bytes
```

A local Chromium check shows the mask buffer can be generated correctly with 24,000,000 bytes. Therefore, this hotfix must **not weaken server validation**. It must harden the editor client payload generation, readiness state, save-race behavior, and diagnostics.

Clarification: `x-mask-byte-length` is diagnostic only. The server must use the actual received request body length as the source of truth. A mask upload is valid only when actual received bytes equal `width * height`; declared client bytes may appear only in safe audit/log diagnostics.

Full-resolution editing must remain the target for this hotfix. Do not downscale or tile masks in RB-080.

---

## Goal

Make full-resolution mask uploads reliable for large images such as 6000×4000 while preserving the current raw `u8raw-v1` upload/persistence contract.

At the end of RB-080:

1. The editor only allows drawing/saving when image dimensions, canvas state, and mask buffer dimensions are consistent.
2. The client validates mask byte length before every upload.
3. The actual request body contains exactly the mask byte length.
4. Semantic, support, and assisted-correction mask upload paths use the hardened upload helper.
5. Server diagnostics remain strict and more informative.
6. A large 6000×4000 mask upload request is covered by focused tests.
7. Existing editor, review, export, prediction and deployment validation gates remain green.

---

## Non-Goals

Do **not** implement these in this ticket:

- mask tiling,
- downscaled working masks,
- sparse/patch uploads,
- new mask serialization format,
- weakening server byte-length validation,
- changing artifact/review/export semantics,
- changing image storage format,
- iPad-specific large-mask workaround,
- broad editor rewrite.

If full-resolution masks remain unreliable on iPad/Safari after RB-080, create a separate ticket for tiled/downscaled working masks.

---

## Required Working Mode

Follow `AGENTS.md`.

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

Work in focused commits.

Suggested commit sequence:

```bash
git commit -m "docs: add editor mask upload byte length hotfix"
git commit -m "fix: harden editor mask upload payloads"
git commit -m "test: cover large editor mask upload requests"
git commit -m "docs: clarify current mask byte format"
git commit -m "chore: finalize editor mask upload hotfix"
```

---

## Implementation Scope

## 1. Harden editor mask upload payload generation

### 1.1 Extract tested upload helper

Extract the editor mask upload payload construction into a focused helper.

Suggested location:

```text
src/features/editor/editorMaskUpload.ts
```

or similar, aligned with current editor module structure.

The helper should take:

```ts
{
  data: Uint8Array
  width: number
  height: number
  format: "u8raw-v1"
}
```

and return:

```ts
{
  body: Uint8Array | ArrayBuffer
  headers: HeadersInit
  byteLength: number
}
```

### 1.2 Client-side byte-length validation

Before every upload, validate:

```ts
mask.data.byteLength === mask.width * mask.height
```

If not, fail before `fetch()` with stable client-side error:

```text
MASK_CLIENT_BYTE_LENGTH_MISMATCH
```

The error should include safe diagnostic values:

```text
expectedBytes
actualBytes
width
height
format
```

Do not include mask bytes.

### 1.3 Ensure exact request body length

The helper must guarantee that the actual request body contains exactly `mask.data.byteLength` bytes.

Important TypedArray rule:

If `mask.data` is a view into a larger `ArrayBuffer`, sending the backing buffer can send extra bytes. The helper must avoid this.

Acceptable approaches:

```ts
const body =
  mask.data.byteOffset === 0 && mask.data.byteLength === mask.data.buffer.byteLength
    ? mask.data
    : mask.data.buffer.slice(mask.data.byteOffset, mask.data.byteOffset + mask.data.byteLength);
```

or an equivalent implementation.

Hard requirement:

```text
sentBodyBytes === mask.data.byteLength === width * height
```

### 1.4 Avoid Blob wrapping

Send raw `Uint8Array` or a correctly sliced `ArrayBuffer` as the request body.

Do not wrap the mask in `Blob` unless there is a proven reason and tests show exact byte length.

### 1.5 Required headers

Every mask upload path must send:

```text
content-type: application/octet-stream
x-mask-format: u8raw-v1
x-mask-width: <width>
x-mask-height: <height>
x-mask-byte-length: <byteLength>
```

If some headers already exist, reuse existing casing/conventions where possible.

---

## 2. Harden editor readiness

The editor must not allow drawing or saving before the image and mask buffer are fully initialized.

The editor is ready only when all are true:

```text
image element is decoded or equivalent dimensions are known
image natural width/height or validated ImageAsset dimensions are available
canvas/backing state is initialized
maskBuffer.width === image width
maskBuffer.height === image height
maskBuffer.data.byteLength === width * height
```

Do not mark the editor ready merely because the image URL was fetched.

If there is a mismatch, show a safe editor error state and do not allow save.

---

## 3. Prevent autosave/manual-save races

Manual save must cancel any pending autosave for the same editor state.

Additionally, add a save sequence/generation guard:

```text
saveGeneration += 1
only the latest save generation may mark the editor saved
stale responses must be ignored or handled safely
```

This prevents a slower autosave response from overwriting a newer manual-save state.

Required behavior:

```text
autosave A starts
manual save B starts and cancels/invalidates A
B succeeds
late A response must not mark stale state or overwrite B's status
```

---

## 4. Apply to all mask upload paths

Use the hardened helper for:

```text
semantic mask upload/commit
support mask upload
assisted correction mask upload/commit
```

If there are separate upload routes or helper wrappers, centralize shared byte-length/header behavior.

Do not change server persistence semantics.

---

## 5. Server-side diagnostics

The server must continue rejecting mismatches with:

```text
MASK_BYTE_LENGTH_MISMATCH
```

Do not weaken validation.

Enhance diagnostics for semantic, support, and correction upload paths:

```text
expectedBytes
receivedBytes
declaredClientBytes
width
height
format
```

`declaredClientBytes` comes from `x-mask-byte-length`.

Rules:

- return stable JSON error response,
- do not make `x-mask-byte-length` authoritative for validation,
- audit/log safe diagnostic metadata,
- do not log payload bytes,
- do not log private storage keys,
- do not log credentials or private URLs.

---

## 6. Mask format documentation

Clarify the current contract:

```text
Current editor upload/persistence format: raw u8raw-v1 bytes
No MSK1 header in current upload body
byte length must equal width * height
one byte per mask pixel
coordinate space is image pixel space
```

If `src/mask/serialize.ts` still exists and uses an older MSK1 helper, document it as:

```text
legacy/test helper
or deferred compatibility helper
```

Do not let docs suggest that current editor upload includes an MSK1 header.

Update relevant docs:

```text
docs/03-features/editor.md
docs/06-data/mask-and-artifact-versioning.md
docs/06-data/annotation-domain-model.md if needed
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/known-gaps.md
docs/adr/remediation-backlog.md
```

---

## Tests

## 1. Unit tests for upload helper

Add tests covering:

### 1.1 Large full-resolution mask

```text
width = 6000
height = 4000
expected byte length = 24,000,000
```

Assert:

```text
helper returns body with exactly 24,000,000 bytes
x-mask-width = 6000
x-mask-height = 4000
x-mask-byte-length = 24000000
x-mask-format = u8raw-v1
content-type = application/octet-stream
```

### 1.2 TypedArray view safety

Create a `Uint8Array` view into a larger `ArrayBuffer` and assert the request body does **not** include extra backing-buffer bytes.

### 1.3 Client mismatch error

A mismatched buffer throws or returns:

```text
MASK_CLIENT_BYTE_LENGTH_MISMATCH
```

before any fetch is attempted.

---

## 2. Route/upload tests

Add representative tests for semantic/support/correction routes where practical.

Minimum:

- truncated body with correct dimensions returns `400 MASK_BYTE_LENGTH_MISMATCH`;
- server diagnostic includes:
  - expectedBytes,
  - receivedBytes,
  - declaredClientBytes,
  - width,
  - height;
- diagnostics do not include private storage data.

---

## 3. Focused E2E smoke for large masks

Add a focused E2E test, separate from the main golden path if practical.

Suggested file:

```text
tests/e2e/large-mask-upload.spec.ts
```

Flow:

```text
upload/open large synthetic image or fixture dimensions 6000×4000
wait until editor readiness confirms actual image/canvas/mask dimensions
draw a tiny stroke
trigger save
intercept mask upload request
assert headers:
  x-mask-width = 6000
  x-mask-height = 4000
  x-mask-byte-length = 24000000
assert request body length = 24,000,000
return mocked success payload matching real API shape sufficiently for editor save flow
```

Do not persist a 24 MB mask if intercepting is sufficient. The mocked response must match the real success payload enough that the editor save flow completes normally.

Existing desktop E2E must remain green.

---

## Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Editor mask upload uses a tested helper.
3. Client validates `byteLength === width * height` before upload.
4. Actual upload body length equals mask byte length, including TypedArray view cases.
5. Upload sends `content-type`, `x-mask-format`, `x-mask-width`, `x-mask-height`, `x-mask-byte-length`.
6. Editor save/draw is disabled until image/canvas/mask buffer are dimensionally ready.
7. Manual save cancels/invalidates pending autosave and stale save responses cannot overwrite current save state.
8. Semantic, support, and assisted-correction uploads use the hardened path.
9. Server keeps `MASK_BYTE_LENGTH_MISMATCH` strict validation and adds safe diagnostics.
10. Current mask format docs clearly state raw `u8raw-v1` without MSK1 header.
11. Large 6000×4000 mask upload helper test passes.
12. Large-mask E2E or equivalent focused integration coverage verifies 24,000,000-byte request behavior.
13. No full-res downscaling/tiling is introduced.
14. Existing editor/review/export/prediction workflows remain green.
15. Ticket is moved to:

```text
tickets/2026-05-21/done/
```

16. Final validation passes:

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

17. Final Codex report includes:
    - commits created,
    - files changed,
    - helper behavior,
    - test coverage,
    - validation commands run,
    - pass/fail status,
    - remaining limitations/backlog entries.

---

## Follow-up if needed

If iPad/Safari or Firefox still struggles with full-resolution 6000×4000 masks after RB-080, create a separate ticket for:

```text
tiled mask upload
downscaled working masks
patch/sparse mask persistence
large-image memory profiling
```

Do not add those to RB-080.
