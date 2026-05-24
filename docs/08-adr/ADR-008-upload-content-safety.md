# ADR-008 - Upload Content Safety Posture

Status: Accepted for current customer-trial posture; implementation follow-ups required before public upload exposure.

Date: 2026-05-24

## Context

SaPen Annotate accepts uploaded raw images, masks, and prediction-import ZIPs through authenticated app routes. The current evidence paths are:

- `src/app/api/projects/[projectId]/images/upload/route.ts` - app-mediated raw image upload.
- `src/app/api/images/[imageId]/mask/upload/route.ts`, `src/app/api/images/[imageId]/support-mask/upload/route.ts`, `src/app/api/slice-crops/[cropId]/support-mask/upload/route.ts`, and `src/app/api/slice-crops/[cropId]/semantic-mask/upload/route.ts` - semantic/support mask saves.
- `src/app/api/prediction-runs/[predictionRunId]/batch-imports/route.ts` and `src/server/domain/predictionImportBatches.ts` - ZIP batch prediction import staging.
- `src/server/uploads/validation.ts` and `src/server/uploads/integrity.ts` - size, content-type, checksum, dimension, and raw mask validation.
- `src/server/storage/s3.ts` - object writes and stat verification.
- `src/server/http/highCostRateLimit.ts` - authenticated high-cost write throttling.

Current validation protects integrity and trial resource bounds. It is not malware scanning and does not claim full content safety.

## Decision

The current authenticated single-host customer-trial posture is acceptable with a documented trust boundary:

- uploads are limited to named authenticated users;
- anonymous upload is not supported;
- MinIO/S3 stays private behind app-mediated routes;
- app, Next proxy, and Caddy body limits must stay aligned;
- supported raw image uploads remain PNG/JPEG only;
- mask uploads remain exact `u8raw-v1` byte arrays;
- prediction batch uploads remain bounded ZIP imports;
- no public or broad internet upload safety claim is made.

Before public or broad untrusted upload exposure, the product requires a quarantine-first upload safety design. The target architecture is:

1. Store new upload bytes under a private quarantine/staging prefix.
2. Scan and policy-check the quarantined object.
3. Decode/re-encode image payloads where applicable and strip metadata before promotion.
4. Promote only accepted normalized objects to durable storage keys and DB rows.
5. Audit rejected uploads without logging file contents, embedded metadata values, full signed URLs, credentials, or tokens.
6. Retain and clean quarantined/rejected objects through explicit retention rules.

## Placement Options

Option A, scan before object storage commit, is simple for small app-mediated uploads but keeps large untrusted payloads in app memory and does not fit direct/staged object workflows well.

Option B, private quarantine/staging then scan and promote, is the selected future direction. It fits the existing storage-cleanup model, can support app-mediated and future staged flows, and gives clear separation between untrusted bytes and durable training artifacts.

Option C, external scanner service or sidecar, is appropriate as the scanner implementation behind Option B. It needs clear timeout, retry, health, and operator-alert behavior before production use.

Option D, decode/re-encode as the primary gate, reduces parser and metadata risk but is not a complete malware scanner. It is required as a complementary hardening step for public exposure, not a replacement for scanning.

## Failure Modes And API Errors

Existing stable errors remain unchanged:

- `UPLOAD_TOO_LARGE`
- `UNSUPPORTED_CONTENT_TYPE`
- `IMAGE_DIMENSIONS_UNREADABLE`
- `IMAGE_DIMENSIONS_UNSUPPORTED`
- `CHECKSUM_MISMATCH`
- `MASK_FORMAT_UNSUPPORTED`
- `MASK_BYTE_LENGTH_MISMATCH`
- `MASK_DIMENSIONS_MISMATCH`
- `SUPPORT_MASK_VALUES_INVALID`
- `PREDICTION_IMPORT_BATCH_PAYLOAD_INVALID`

Future public-exposure hardening should add stable API errors without renaming existing ones:

- `UPLOAD_SCAN_UNAVAILABLE`
- `UPLOAD_SCAN_TIMEOUT`
- `UPLOAD_CONTENT_REJECTED`
- `UPLOAD_DECODE_FAILED`
- `UPLOAD_METADATA_REJECTED`
- `UPLOAD_QUARANTINE_EXPIRED`
- `UPLOAD_PROMOTION_FAILED`

Errors should follow the protected API error-contract conventions from RB-106: sanitized JSON, stable codes, no object storage keys unless already safe for the caller, and no uploaded content echo.

## Logging, Audit, And Cleanup

Upload safety logs and audit rows may include actor id/context, route family, project id, image id or batch id when available, byte size, declared content type, normalized error code, checksum, and quarantine object age.

They must not include raw uploaded bytes, embedded metadata values, EXIF payloads, full signed URLs, credentials, raw auth headers, cookies, or password/secret file paths.

RB-114 cleanup/consistency reporting remains additive. Quarantined and rejected objects should become a new temporary-object category with retention settings. Missing committed raw images, committed artifact versions, derived crops, prediction artifacts, and export packages remain protected-object drift; ordinary quarantine cleanup candidates are findings only unless a promoted durable DB reference is missing or checksum/size mismatched.

## Consequences

The current trial may continue under authenticated named-user access and operator oversight, but docs must not imply malware/content-safety scanning exists.

Public or broad untrusted upload exposure is blocked until the follow-up implementation tickets are completed:

- `RB-118-A-upload-quarantine-staging-policy.md`
- `RB-118-B-image-decode-reencode-and-metadata-stripping.md`
- `RB-118-C-malware-scanner-integration.md`
- `RB-118-D-upload-rejection-audit-and-cleanup.md`
- `RB-118-E-reverse-proxy-upload-limit-alignment.md`

RB-113 remains separate and deferred; this ADR does not complete real iPad Safari evidence.
