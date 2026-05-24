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
2. [RB-106 - Protected API Error Contract Completion](RB-106-protected-api-error-contract-completion.md)
3. [RB-108 - Root Architecture Current-Flow Drift](RB-108-root-architecture-current-flow-drift.md)
4. [RB-107 - Safe Version Allocation Concurrency Hardening](RB-107-safe-version-allocation-concurrency-hardening.md)
5. [RB-109 - DB Constraint Hardening For Review And Export Integrity](RB-109-db-constraint-hardening-review-export-integrity.md)
6. [RB-111 - High-Cost Write Rate Limits And Trial Caps](RB-111-high-cost-write-rate-limits-and-trial-caps.md)
7. [RB-112 - Async And Streaming Export Job Hardening](RB-112-async-streaming-export-job-hardening.md)
8. [RB-113 - Real iPad Safari Trial Gate Execution](RB-113-real-ipad-safari-trial-gate-execution.md)
9. [RB-110 - External Handoff Archive Validation](RB-110-external-handoff-archive-validation.md)
10. [RB-114 - Storage/DB Consistency Operations Hardening](RB-114-storage-db-consistency-operations-hardening.md)
11. [RB-115 - System Actor Attribution Model ADR](RB-115-system-actor-attribution-model-adr.md)
12. [RB-116 - Audit Coverage Matrix And Guard](RB-116-audit-coverage-matrix-and-guard.md)
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

## Completion Protocol

When a ticket is implemented:

1. Follow the baseline and validation requirements inside that ticket.
2. Update relevant docs/backlog entries.
3. Commit the completed slice.
4. Move the ticket into `tickets/2026-05-23/done/` or the dated `done/` folder matching the implementation day.
