# RB-117 - CLI Secret Handling Password Flag Deprecation

## Status

Planned

## Priority

P3

## Type

Operations / Security Hygiene / CLI Scripts

## Source

- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`

## Depends On

- Current operations scripts and docs.

## Blocks

- Cleaner operational secret handling before broader customer operations.

## Context

Operational scripts such as prediction import processing and storage cleanup accept `--password`. CLI password arguments can leak through shell history or process inspection. Environment variables are already preferable for Compose/operator workflows.

## Goal

Deprecate command-line password arguments and document safer alternatives.

## Non-Goals

- Do not introduce a new secrets manager.
- Do not break existing automation without a transition path.
- Do not change app login semantics.

## Requirements

- Inventory scripts that accept `--password`.
- Add deprecation warnings for password arguments.
- Prefer environment variables or file-mounted secrets.
- Consider stdin prompt/input for manual local usage if practical.
- Update operations docs and examples.
- Add tests for env/file/stdin handling and warning behavior where scripts are covered.

## Acceptance Criteria

- Docs no longer recommend passing passwords as command-line arguments.
- Scripts continue to work through safer secret inputs.
- Existing Compose/trial workflows remain functional.
- Any retained `--password` compatibility is clearly marked deprecated.

## Validation

Run:

```bash
git status --short
npm run lint
npm run typecheck
npm run test
```
