# 2026-05-23 Review-Derived Ticket Sequence

## Purpose

This folder contains the review reports from 2026-05-23 and the implementation ticket sequence derived from them.

Source reports:

- `sapen-annotate-deep-review-2026-05-23.md`
- `sapen_annotate_deep_review_report_chatGPT.md`
- `sapen-annotate-combined-deep-review-2026-05-23.md`
- `sapen_annotate_codex_combined_report_verification.md`

Use the combined report plus verification report as the planning baseline. The original ChatGPT static report is useful context, but its rejected findings, especially the `docs/README.md` broken-link claim, must not be reintroduced as defects.

## Recommended Order

1. [RB-105 - Presigned Compatibility Upload Immutability Gap](done/RB-105-presigned-compatibility-upload-immutability-gap-optimized.md) - completed
2. [RB-106 - Protected API Error Contract Completion](done/RB-106-protected-api-error-contract-completion-optimized.md) - completed
3. [RB-108 - Root Architecture Current-Flow Drift](done/RB-108-root-architecture-current-flow-drift-optimized.md) - completed
4. [RB-107 - Safe Version Allocation Concurrency Hardening](done/RB-107-safe-version-allocation-concurrency-hardening-optimized.md) - completed
5. [RB-109 - DB Constraint Hardening For Review And Export Integrity](done/RB-109-db-constraint-hardening-review-export-integrity-optimized.md) - completed
6. [RB-111 - High-Cost Write Rate Limits And Trial Caps](done/RB-111-high-cost-write-rate-limits-and-trial-caps-optimized-post-RB110.md) - completed
7. [RB-112 - Async Export Job Hardening](done/RB-112-async-export-job-hardening-optimized-post-RB111.md) - completed
8. [RB-113 - Real iPad Safari Trial Gate Execution](RB-113-real-ipad-safari-trial-gate-execution-optimized-post-RB112.md)
9. [RB-110 - External Handoff Archive Validation](done/RB-110-external-handoff-archive-validation-optimized-post-RB109.md) - completed
10. [RB-114 - Storage/DB Consistency Operations Hardening](done/RB-114-storage-db-consistency-operations-hardening-optimized-post-RB112.md) - completed
11. [RB-115 - System Actor Attribution Model ADR](done/RB-115-system-actor-attribution-model-adr-optimized-post-RB114.md) - completed
12. [RB-116 - Audit Coverage Matrix And Guard](done/RB-116-audit-coverage-matrix-and-guard-optimized-post-RB115.md) - completed
13. [RB-117 - CLI Secret Handling Password Flag Deprecation](RB-117-cli-secret-handling-password-flag-deprecation.md)
14. [RB-118 - Upload Content Safety Hardening Design](RB-118-upload-content-safety-hardening-design.md)
15. [RB-119 - Documentation Governance Polish After Deep Review](RB-119-doc-governance-polish-after-deep-review.md)
16. [RB-120 - Opportunistic Large Module Decomposition](RB-120-opportunistic-large-module-decomposition.md)

## Priority Notes

- RB-105 is first because it directly affects raw image and mask artifact immutability.
- RB-106 should be handled before broader API changes so future routes inherit a stable error convention.
- RB-108 is documentation-only but should happen early because `ARCHITECTURE.md` is the agent/contributor entry point.
- RB-107 should precede DB constraint work because it fixes live write behavior rather than only rejecting invalid rows.
- RB-113 remains a real-device manual gate and must not be marked complete without actual iPad Safari evidence.

## RB-115 Follow-Ups

- [RB-115-A - Audit Actor Context Fields](done/RB-115-A-audit-actor-context-fields-optimized.md) - completed
- [RB-115-B - Unattended Worker Actor Context](RB-115-B-unattended-worker-actor-context.md)
- [RB-115-C - Core Handoff Actor Provenance Contract](RB-115-C-core-handoff-actor-provenance-contract.md)

## RB-116 Follow-Ups

- [RB-116-A - Trial Bootstrap Operator Attribution](RB-116-A-trial-bootstrap-operator-attribution.md)

## Completion Protocol

When a ticket is implemented:

1. Follow the baseline and validation requirements inside that ticket.
2. Update relevant docs/backlog entries.
3. Commit the completed slice.
4. Move the ticket into `tickets/2026-05-23/done/` or the dated `done/` folder matching the implementation day.
