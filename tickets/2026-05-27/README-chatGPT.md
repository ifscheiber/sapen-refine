# Assistant-Side Deep Review Ticket Input

Status: Superseded by [README.md](README.md)

This file preserves the assistant-side deep-review ticket input that was supplied after the Codex RB-130 through RB-135 sprint was created. The authoritative reconciled sprint index is [README.md](README.md).

## Numbering

Codex deep-review tickets keep RB-130 through RB-135:

1. RB-130 - Trial runtime config env propagation for rate limits and export caps
2. RB-131 - Runtime environment docs, templates, and secret-input parity
3. RB-132 - Current-state and architecture documentation drift cleanup
4. RB-133 - Opportunistic decomposition map refresh and hotspot guard
5. RB-134 - User lifecycle deactivation and attribution preservation
6. RB-135 - Ticket and docs governance scope extension

Assistant-side additional findings are renumbered as:

1. RB-136 - Approved snapshot freshness gating
2. RB-137 - Storage cleanup coverage for crop object prefixes
3. RB-138 - Deep checksum consistency for primary storage objects
4. RB-139 - Prediction batch ZIP inflation guard
5. RB-140 - Export job processor RBAC and audit alignment
6. RB-141 - ReviewDecision target DB invariant
7. RB-142 - Mask statistic metadata for readiness performance

## Suggested consolidated risk-first order

1. RB-130 - Trial runtime config env propagation for rate limits and export caps
2. RB-136 - Approved snapshot freshness gating
3. RB-139 - Prediction batch ZIP inflation guard
4. RB-137 - Storage cleanup coverage for crop object prefixes
5. RB-134 - User lifecycle deactivation and attribution preservation
6. RB-141 - ReviewDecision target DB invariant
7. RB-140 - Export job processor RBAC and audit alignment
8. RB-131 - Runtime environment docs, templates, and secret-input parity
9. RB-132 - Current-state and architecture documentation drift cleanup
10. RB-135 - Ticket and docs governance scope extension
11. RB-138 - Deep checksum consistency for primary storage objects
12. RB-142 - Mask statistic metadata for readiness performance
13. RB-133 - Opportunistic decomposition map refresh and hotspot guard

Codex should reconcile this list against the current repository state and may merge tickets only when the implementation scope, impacted files, and acceptance criteria are substantially identical.

## Reconciliation Result

The reconciled sprint kept RB-136, RB-137, RB-138, RB-139, RB-140, and RB-142 as active tickets. RB-141 was reviewed but marked not active because resolved RB-109 already implemented the ReviewDecision exact-one-target database invariant.
