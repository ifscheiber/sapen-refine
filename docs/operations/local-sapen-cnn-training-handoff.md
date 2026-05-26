# Local SaPen-CNN Training Handoff

## Purpose

This page will document the operator workflow for materializing SaPen Annotate CNN
training snapshots into local `sapen-cnn` dataset folders.

The authoritative data contract is
[`../06-data/sapen-cnn-training-dataset-snapshot-contract.md`](../06-data/sapen-cnn-training-dataset-snapshot-contract.md).

## Current Status

Planned for the 2026-05-26 export sprint. Until the materializer is implemented, do not
claim that Annotate can create local `sapen-cnn` folders directly.

## Invariants

- Do not record object-storage secrets in docs, manifests, reports, or shell history.
- Do not modify tracked files in `../sapen-cnn` from the Annotate materializer.
- Public manifests must not expose storage keys, buckets, or signed URLs.
