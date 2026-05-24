# RB-118 - Upload Content Safety Hardening Design (Optimized Post-RB-117)

## Status

Planned / Design

## Priority

P3 for internal authenticated trial; P2 before public or internet-exposed upload posture

## Type

Security Design / Upload Safety / Trust Boundary / Operations / Follow-Up Planning

## Source

- `tickets/2026-05-23/sapen_annotate_deep_review_report_chatGPT.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- Original RB-118 ticket.
- Completed RB-105/RB-111/RB-114/RB-117 baseline where applicable.

## Depends On

- Current upload integrity validation from RB-055.
- Current upload/storage behavior after RB-105, if RB-105 is complete in this repo state.
- Current high-cost limits and upload/export caps after RB-111.
- Current storage/DB consistency reporting after RB-114.
- Current secret-handling guidance after RB-117.
- Deployment exposure decision:
  - internal authenticated trial,
  - customer-trial host,
  - public internet-exposed upload,
  - future multi-tenant/product deployment.

## Blocks

- Any public or broad internet-exposed upload posture.
- Any claim that upload validation includes malware/content-safety scanning.
- Any decision to accept uploads from untrusted external users without additional controls.

## Context

The current upload path validates integrity-oriented properties such as:

- content type,
- byte size,
- dimensions,
- checksum,
- object metadata/stat checks,
- route/API authorization,
- high-cost limits/caps after RB-111.

That is not the same as content safety.

The deep review found that there is no dedicated malware scanning, controlled decode/re-encode safety pipeline, or metadata stripping pipeline. For an internal authenticated trial, this may be acceptable with clear trust-boundary documentation. For public exposure, a stronger design is required.

RB-118 should define the upload content-safety posture and follow-up implementation plan. It should not prematurely implement a scanner or image-processing pipeline unless the team explicitly reschedules it.

## Goal

Create a clear design document or ADR for production upload content safety.

The design must answer:

- What is the current trust boundary?
- What is acceptable for internal/customer trial?
- What is required before public internet exposure?
- Where would scanning, decode/re-encode, metadata stripping, sandboxing, and reverse-proxy limits fit?
- What stable API/user-facing errors should unsafe/rejected uploads produce?
- Which implementation tickets are needed, if any?

## Non-Goals

- Do not implement malware scanning in this ticket unless explicitly rescheduled.
- Do not add new upload formats.
- Do not weaken current upload integrity validation.
- Do not change RB-111 rate-limit/cap behavior unless only docs need alignment.
- Do not change RB-114 cleanup/consistency behavior unless only docs need alignment.
- Do not introduce a new secrets manager.
- Do not log uploaded file contents.
- Do not complete or fabricate RB-113 iPad evidence.

## Required Investigation

Review and summarize current behavior in:

- image upload API routes,
- mask upload routes,
- compatibility presign/commit routes if still present,
- storage helper(s),
- upload validation helpers,
- runtime config for upload limits,
- reverse proxy/deployment docs,
- known gaps/security docs,
- cleanup/consistency docs after RB-114,
- high-cost rate-limit docs after RB-111.

Document:

- accepted content types and formats,
- size/dimension caps,
- checksum behavior,
- where bytes are parsed/decoded or not decoded,
- where files enter object storage,
- whether metadata/EXIF is preserved,
- what errors are returned,
- what logs/audit rows may include,
- what assumptions are made about authenticated users.

## Design Topics

### 1. Current Trust Boundary

Define the current deployment assumptions:

- internal named users,
- authenticated customer-trial users,
- no anonymous upload,
- operator oversight,
- trial-size data,
- reverse-proxy/body limits where present.

State clearly whether current validation is acceptable for this posture.

### 2. Public Exposure Prerequisites

Define minimum prerequisites before public or broad internet upload exposure, such as:

- malware scanning,
- controlled image decode/re-encode,
- EXIF/metadata stripping,
- sandboxed processing,
- MIME sniffing beyond declared content type,
- stricter reverse-proxy body limits,
- quarantine/staging area before DB commit,
- retry/failure behavior,
- operator alerting or drift reporting,
- retention rules for rejected/quarantined uploads.

### 3. Scanner Placement Options

Compare options:

#### Option A - Scan Before Object Storage Commit

Pros/cons for app-mediated upload.

#### Option B - Store In Quarantine/Staging, Scan, Then Promote

Pros/cons, especially if presign/staging flows exist after RB-105.

#### Option C - External Scanner Service / Sidecar

Pros/cons for Docker/single-host trial vs production.

#### Option D - Decode/Re-Encode As Primary Safety Gate

Pros/cons and limitations; note that this is not a complete malware scanner but can reduce parser/metadata risk.

### 4. Image Decode/Re-Encode And Metadata Stripping

Evaluate:

- whether uploaded images should be decoded with a controlled library,
- whether output should be normalized to a safe internal format,
- whether EXIF/metadata should be stripped,
- whether original bytes should be retained for traceability,
- how checksum/provenance should record original vs normalized bytes,
- storage impact.

### 5. Failure Modes And API Contract

Define stable failure categories, for example:

- unsupported media type,
- size/dimension limit exceeded,
- decode failed,
- scanner unavailable,
- malware/suspicious content detected,
- metadata policy violation,
- quarantine timeout.

Map them to stable API error codes consistent with RB-106 error contracts.

### 6. Logging, Audit, And Secret/File Safety

Define:

- never log uploaded file bytes,
- never log embedded metadata values unless intentionally sanitized,
- never log full signed URLs,
- how to audit rejected uploads without storing dangerous content,
- how actor context should apply if the upload is rejected before DB commit,
- how cleanup handles quarantined/rejected objects.

### 7. Interaction With Existing Tickets

Document interaction with:

- RB-105: final-key immutability / staging-key flow if present.
- RB-111: upload rate limits and caps.
- RB-114: cleanup/consistency visibility for staging/quarantine/rejected objects.
- RB-116: audit classification of upload/rejected-upload paths.
- RB-117: no secrets in scanner/operator commands.

## Required Outputs

- A new design doc or ADR, following repo conventions, for example:
  - `docs/08-adr/ADR-XXX-upload-content-safety.md`, or
  - `docs/security/upload-content-safety.md`
- Updates to known gaps/current-state/security docs.
- Clear statement of current trial posture.
- Clear public-exposure prerequisite list.
- Follow-up implementation tickets if needed.

## Follow-Up Ticket Guidance

If implementation work is needed, create focused tickets such as:

- `RB-118-A-upload-quarantine-staging-policy.md`
- `RB-118-B-image-decode-reencode-and-metadata-stripping.md`
- `RB-118-C-malware-scanner-integration.md`
- `RB-118-D-upload-rejection-audit-and-cleanup.md`
- `RB-118-E-reverse-proxy-upload-limit-alignment.md`

Do not create a vague broad ticket like `fix upload security`.

## Acceptance Criteria

- A clear design doc or ADR exists for upload content safety.
- The doc distinguishes integrity validation from content safety.
- Public exposure prerequisites are explicit.
- Current internal/customer-trial posture is either accepted with rationale or given required fixes.
- Scanner/quarantine/decode-reencode placement options are compared.
- Stable failure modes/API error categories are defined.
- Logging/audit rules prevent uploaded file contents and secrets from being logged.
- Follow-up tickets exist for any required implementation work.
- RB-113 remains open unless real physical iPad evidence was provided separately.
- No product behavior changes are made unless explicitly documented as tiny docs/config alignment.

## Validation

For docs/design-only work:

```bash
git status --short
git diff --check
npm run lint
npm run handoff:archive -- --dry-run
```

If Codex touches code, tests, config, package scripts, or schema, also run relevant validation:

```bash
npm run prisma:generate
npm run typecheck
npm run build
npm run test
```

## Completion Protocol

1. Add the design doc/ADR.
2. Update known gaps/current-state/security docs.
3. Create focused follow-up tickets if implementation is required.
4. Move this optimized ticket to the appropriate `done/` folder.
5. Leave RB-113 open unless physical iPad evidence exists.
6. Commit the docs/design slice.
7. Ensure `npm run handoff:archive -- --dry-run` passes on a clean worktree.

## Notes For Codex

- Treat this as a design/security posture ticket.
- Do not implement a malware scanner unless explicitly instructed.
- Do not weaken current upload validation.
- Do not record uploaded content in docs, logs, tests, or examples.
- Be precise about trial vs public-exposure claims.
