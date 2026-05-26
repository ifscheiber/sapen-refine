# RB-110 - External Handoff Archive Validation

## Status

Completed

## Priority

P2/P3

Upgrade to P2 if manually created archives are shared with external reviewers, Codex, customers, or other third parties. P3 is acceptable if all handoffs are created exclusively through the existing repo script and no external/manual ZIPs are reviewed or shared.

## Type

Operations / Handoff Hygiene / Security Process / Archive Tooling / Tests

## Source

- `docs/adr/remediation-backlog.md` RB-110
- `tickets/2026-05-23/sapen_annotate_deep_review_report_chatGPT.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- Current post-RB-109 implementation state:
  - RB-106 completed in commit `a4e69f6`.
  - RB-108 completed in commit `0a8126b`.
  - RB-107 completed in commit `1d135ce`.
  - RB-109 completed in commit `3b77d51`.

## Depends On

- Existing `npm run handoff:archive` creation flow from RB-069.
- Existing handoff exclusion policy in `scripts/create-handoff-archive.mjs` and `docs/operations/handoff-zip-checklist.md`.
- Current post-RB-109 repo state, where the official handoff dry-run is green with `--allow-dirty` but strict mode still fails because of known pre-existing untracked user-side files.

## Blocks

- Safe sharing/review of manually created or externally supplied ZIP archives.
- Preventing accidental leakage of `.env`, `.git`, build output, traces, local volumes, or other non-handoff material through ad-hoc archives.

## Context

During the deep-review process, one manually supplied archive contained `.env`, `.env.local`, and `.git`. The current repository does not track those env files, and the preferred handoff creation script already excludes forbidden paths. Therefore this is not a production app defect and not a tracked-repo defect.

The remaining gap is operational: reviewers/operators may still receive or create arbitrary ZIP files that bypass `npm run handoff:archive`. Those archives need a safe validator that reports forbidden paths without exposing file contents or secret values.

Post-RB-109 baseline:

- Review/export DB integrity constraints are now implemented and are unrelated to this ticket.
- The official handoff command is reported green with `--allow-dirty` and includes the current committed RB-109 state.
- Strict handoff dry-run without `--allow-dirty` is still expected to fail only because of known untracked user-side files:
  - `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
  - `tickets/2026-05-23/sapen_annotate_deep_review_report_chatGPT.md`
  - `tickets/design/`
- RB-110 must not try to solve the dirty worktree state or move/delete those user-side files. It should validate ZIP contents independently of current worktree cleanliness.

## Goal

Add a reusable validator for arbitrary handoff ZIP archives so manually created or externally supplied archives can be checked before review, upload, or customer sharing.

## Non-Goals

- Do not replace `npm run handoff:archive`; it remains the preferred archive creation path.
- Do not change production application code.
- Do not inspect or print secret values.
- Do not upload archives anywhere.
- Do not implement antivirus/malware scanning; upload content safety is RB-118.
- Do not try to validate application correctness from the ZIP. This ticket only validates archive hygiene.
- Do not fix, remove, move, or commit the known untracked user-side review/design files.
- Do not alter RB-109 DB constraints, migrations, or review/export logic.

## Required Implementation Approach

### 1. Add a dedicated validator script

Add a script such as:

```bash
scripts/validate-handoff-archive.mjs <path-to-archive.zip>
```

and expose it through `package.json`, for example:

```bash
npm run handoff:validate -- <path-to-archive.zip>
```

The script must:

- accept a ZIP path as input,
- fail clearly if the path is missing, unreadable, or not a ZIP file,
- scan entry names without extracting file contents to disk,
- normalize entry paths to avoid bypasses through `./`, duplicate slashes, nested prefixes, URL-style slashes, or Windows path separators,
- reject directory traversal-like entries such as `../...`, `a/../../...`, absolute Unix paths, and Windows drive/UNC paths,
- print only path names and summary counts, never file contents.

### 2. Reuse or mirror the handoff exclusion policy

Where practical, share exclusion logic with `scripts/create-handoff-archive.mjs` or extract a small shared allow/deny helper. If sharing would require risky refactoring, duplicate the policy deliberately and add tests that keep both policies aligned.

The validator must reject at least:

- `.env`, `.env.*` except explicitly allowed example/template files such as `.env.example`, `.env.template`, or documented non-secret samples,
- `.git` and any `.git/**` entries,
- `node_modules/**`,
- `.next/**`, `out/**`, `build/**`, `dist/**`,
- test reports, traces, screenshots, videos, and Playwright artifacts,
- local database/storage volumes,
- log files where they are not expected handoff artifacts,
- `*.tsbuildinfo`,
- OS/editor noise where applicable, e.g. `.DS_Store`, `Thumbs.db`.

The validator must treat nested forbidden paths as forbidden too, for example:

- `repo/.git/config`,
- `sapen-annotate/.env.local`,
- `some-wrapper/node_modules/...`,
- `archive-root/.next/cache/...`.

### 3. Keep output operator-safe

On failure, output should include:

- archive path,
- number of entries scanned,
- list of forbidden entry names,
- concise remediation hint: regenerate with `npm run handoff:archive` or remove forbidden material and re-run validation.

On success, output should include:

- archive path,
- number of entries scanned,
- clear pass message.

Never dump file contents, env variable values, git config contents, logs, binary metadata, or archive payload snippets beyond path names/counts.

### 4. Add fixture-based tests

Add focused unit/integration tests for the validator using small generated ZIP fixtures. Do not rely on the developer’s current worktree state for test correctness.

Test cases should include at minimum:

- valid archive shaped like `npm run handoff:archive`,
- `.env.example` allowed,
- `.env.template` allowed if the repo policy allows it,
- `.env` rejected,
- `.env.local` rejected,
- nested `.env` rejected,
- `.git/config` rejected,
- nested `.git` rejected,
- `node_modules` rejected,
- `.next` or build output rejected,
- test traces/videos/screenshots rejected,
- `../evil`, `a/../../evil`, absolute Unix path, and Windows drive/UNC entries rejected,
- output does not include file contents.

### 5. Optional positive integration check against the official archive tool

If the official archive command can produce a real ZIP in the test/runtime environment, add or document a positive check that validates an archive created by `npm run handoff:archive`.

If the official command cannot be run in strict mode because of known untracked user-side files, this ticket may use `--allow-dirty` for the integration check, but must document why strict mode was not used.

### 6. Documentation

Update `docs/operations/handoff-zip-checklist.md` and any relevant README/backlog entry:

- Make `npm run handoff:archive` the preferred creation path.
- Instruct operators to run the validator on any external/manual ZIP before sharing or review.
- Explain that the validator checks archive hygiene, not code correctness or DB integrity.
- Explain that strict handoff creation can fail on dirty worktrees, while the validator operates on an already created ZIP.
- Mention that real secrets must be rotated if an archive with `.env`, `.env.local`, `.git`, logs, or other sensitive material was already shared externally.

## Acceptance Criteria

- `npm run handoff:validate -- <archive.zip>` exists and validates arbitrary ZIP files.
- Validator passes on valid handoff-shaped fixture archives.
- Validator rejects archives containing forbidden paths, including nested forbidden paths.
- Validator rejects suspicious path traversal and absolute-path entries.
- Validator output lists forbidden path names but never file contents or secret values.
- Tests cover allowed `.env.example` and rejected `.env`, `.env.local`, `.git`, `node_modules`, build output, and traversal entries.
- Handoff checklist documents when and how to run the validator.
- The implementation does not modify production application code.
- The implementation does not modify RB-109 DB constraints/migrations/review-export logic.
- Known untracked user-side review/design files are not moved, deleted, or committed as part of RB-110.

## Suggested Validation

Run:

```bash
git status --short
npm run lint
npm run typecheck
npm run test
npm run handoff:archive -- --dry-run --allow-dirty
```

Run the new validator against generated or fixture archives:

```bash
npm run handoff:validate -- <valid-fixture-or-generated-archive.zip>
npm run handoff:validate -- <invalid-fixture-containing-env-or-git.zip>
```

If a strict handoff dry-run is attempted and fails only because of the known pre-existing untracked user-side report/design files, document that exact reason and use the `--allow-dirty` variant as the operational baseline for this slice.

## Codex Notes

- This is an operations/tooling ticket, not an application runtime ticket.
- Do not read or print archive file contents.
- Be careful with path normalization; most bypasses in archive validators come from nested prefixes, Windows separators, absolute paths, URL-like paths, or `..` entries.
- Avoid broad refactoring of `create-handoff-archive.mjs` unless it is clearly safer than duplicating the exclusion policy.
- Keep tests fixture-based so they do not depend on the current dirty/clean worktree state.

## Implementation Notes

- Added `scripts/handoff-archive-policy.mjs` as the shared handoff path policy for archive creation and validation.
- Added `scripts/validate-handoff-archive.mjs` and exposed it as `npm run handoff:validate -- <archive.zip>`.
- The validator scans ZIP entry names only, rejects forbidden handoff paths, rejects traversal/absolute/Windows drive/UNC-style paths, and reports path names plus counts without archive contents.
- Extended `tests/unit/handoff-archive.test.ts` with generated ZIP fixtures for valid archives, forbidden entries, traversal entries, and output safety.
- Updated the handoff checklist, testing docs, remediation backlog, and sprint index.

## Validation Notes

- Baseline before editing: `git status --short` was clean; existing `tests/unit/handoff-archive.test.ts` passed with 4/4 tests.
- Focused post-implementation validation: `npm run test -- tests/unit/handoff-archive.test.ts` passed with 9/9 tests.
- `git diff --check` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run handoff:validate -- /tmp/rb110-valid.zip` passed on a generated valid fixture archive.
- `npm run handoff:validate -- /tmp/rb110-invalid.zip` failed as expected on a generated invalid fixture archive and printed only forbidden path names.
- `npm run test` passed with 46 files and 241 tests.
- `npm run handoff:archive -- --dry-run` failed before commit because the RB-110 working tree was dirty.
- `npm run handoff:archive -- --dry-run --allow-dirty` passed before commit and reported 529 files.
- Final post-commit `npm run handoff:archive -- --dry-run` passed with 531 files and `Dirty: no`.
