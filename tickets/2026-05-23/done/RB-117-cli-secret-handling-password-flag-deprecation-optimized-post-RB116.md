# RB-117 - CLI Secret Handling Password Flag Deprecation (Optimized Post-RB-116)

## Status

Completed

## Priority

P3

## Type

Operations / Security Hygiene / CLI Secret Handling / Documentation / Tests

## Source

- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- Completed RB-111: high-cost write limits and export caps.
- Completed RB-112: async export job processing.
- Completed RB-114: storage/DB consistency reporting.
- Completed RB-115 / RB-115-A: actor context ADR and structured `details.actorContext`.
- Completed RB-116: audit coverage matrix and guard.

## Depends On

- Current operational scripts and docs.
- Current operator/API authentication conventions.
- RB-115-B may later improve unattended worker actor context, but is not required for this secret-handling hygiene slice.
- RB-113 remains open and must not be completed by this ticket.

## Related Tickets

- RB-115-B: unattended worker actor context. This may later adjust how unattended worker runs authenticate and attribute system actors.
- RB-116-A: trial bootstrap operator attribution. Do not implement it here unless it is a tiny docs link/update.
- RB-118: upload content safety design.

## Blocks

- Cleaner operational secret handling before broader customer operations.
- Avoiding normalization of `--password` CLI examples in docs and tickets.
- Safer manual operator usage of export processing, prediction import processing, and storage cleanup.

## Context

Some operational scripts accept `--password` or have examples that encourage passing passwords as command-line arguments. CLI password arguments can leak through shell history, terminal scrollback, process inspection, CI logs, copied commands, or support screenshots.

The repository now has more operational entrypoints than before:

- async export processing from RB-112,
- storage cleanup/consistency reporting from RB-114,
- prediction import processing,
- admin/operator API endpoints,
- audit actor-context work from RB-115-A/RB-116.

RB-117 is a focused security hygiene ticket: deprecate command-line password arguments and document safer alternatives without redesigning authentication or worker scheduling.

## Goal

Deprecate command-line password arguments for operator scripts and documentation, and make safer secret inputs the preferred path.

The result should make it difficult for future docs, examples, and scripts to normalize this pattern:

```bash
npm run some:operator-script -- --email user@example.test --password 'secret'
```

Instead, scripts and docs should prefer environment variables, file-mounted secrets, or stdin/prompt-based input where practical.

## Non-Goals

- Do not introduce a new secrets manager.
- Do not redesign authentication, sessions, RBAC, or operator authorization.
- Do not implement RB-115-B unattended worker authentication.
- Do not change RB-112 export job architecture.
- Do not change RB-114 cleanup deletion/consistency behavior.
- Do not remove backwards compatibility abruptly if existing documented trial/operator workflows still depend on it.
- Do not log or print secrets.
- Do not complete or fabricate RB-113 iPad evidence.

## Required Inventory

Search the repo for password CLI usage and examples, including at least:

- `scripts/*.mjs`
- `package.json` scripts
- deployment docs
- operations docs
- testing docs
- manual smoke docs
- tickets and active sprint docs where relevant
- README/runbooks that mention operator commands

Look for:

- `--password`
- `password`
- `SAPEN_OPERATOR_PASSWORD`
- `ADMIN_PASSWORD`
- `EXPORTS_PROCESS_PASSWORD`
- `storage:cleanup`
- `exports:process`
- `prediction-import`
- `process-due`

Do not modify historical completed tickets unless they are active instructions. It is acceptable to add a current note saying old examples are historical and the current preferred method is env/file/stdin.

## Requirements

### 1. Identify Affected Scripts

Inventory every script that accepts password-like CLI arguments.

Likely candidates include but are not limited to:

- export processing script introduced/used after RB-112,
- storage cleanup script used after RB-114,
- prediction import processing scripts,
- bootstrap/admin/operator scripts.

For each script, record:

- whether it currently accepts `--password`,
- whether it also supports env vars,
- whether it can support file-mounted secrets,
- whether stdin/prompt input is practical,
- current docs/examples that need updates.

### 2. Preferred Secret Input Order

Define and document the preferred order for operator credentials/secrets.

Recommended order:

1. explicit file-mounted secret path, if supported;
2. environment variable, for Compose/CI/operator automation;
3. stdin/prompt for manual local runs, if practical;
4. deprecated `--password` argument only as temporary compatibility.

The exact env/file names should follow existing repo conventions.

### 3. Deprecate `--password`

For scripts that still accept `--password`:

- keep compatibility unless removing it is clearly safe;
- print a warning to stderr when used;
- never echo the password value;
- never include it in structured logs;
- never include it in audit `details.actorContext`;
- document that it will be removed or should not be used in operator runbooks.

Example warning:

```text
Warning: --password is deprecated because command-line arguments can leak through shell history or process lists. Use SAPEN_OPERATOR_PASSWORD or a file-mounted secret instead.
```

### 4. Update Documentation And Examples

Replace active examples like:

```bash
npm run exports:process -- --email qa@example.test --password '<not-recorded>'
```

with env/file/stdin alternatives, for example:

```bash
SAPEN_OPERATOR_EMAIL='qa@example.test' \
SAPEN_OPERATOR_PASSWORD='<not-recorded>' \
npm run exports:process -- --max-jobs 2
```

or a file-secret form if implemented:

```bash
SAPEN_OPERATOR_EMAIL='qa@example.test' \
SAPEN_OPERATOR_PASSWORD_FILE=/run/secrets/sapen_operator_password \
npm run exports:process -- --max-jobs 2
```

Do not record actual secret values.

### 5. Interaction With Actor Context / Audit

Ensure secret inputs are not copied into:

- `AuditLog.details`,
- `details.actorContext`,
- export job records,
- cleanup logs,
- processor run ids,
- error messages,
- thrown exceptions,
- test snapshots.

If a script uses operator identity for attribution, record only non-secret identity such as email/user id/operator label.

### 6. Tests

Add or update tests for:

- env-var secret input works;
- file-secret input works if implemented;
- deprecated `--password` still works or fails with a clear intentional message, depending on chosen compatibility;
- deprecation warning does not include the secret;
- `--help` output documents preferred secret input;
- docs/examples do not recommend `--password`;
- no command output includes the secret value.

A static grep-style test is acceptable for docs if it is scoped to active docs and allowlists historical done tickets.

### 7. Backward Compatibility

If existing workflows rely on `--password`, preserve compatibility for now with a warning.

If removing `--password` is safe, explain why and update all docs/tests accordingly.

Do not break `npm run handoff:archive -- --dry-run`.

## Acceptance Criteria

- Active docs no longer recommend passing passwords as command-line arguments.
- Affected scripts prefer env/file/stdin secret inputs.
- Any retained `--password` support is explicitly deprecated and warns without leaking the secret.
- Existing Compose/trial/operator workflows remain functional or have a documented migration path.
- Tests prove preferred secret input behavior and no secret echo in warnings/output.
- Audit actor context does not contain credentials.
- RB-113 remains open unless real physical iPad evidence was provided separately.
- Worktree is clean and handoff archive dry-run passes.

## Validation

Run:

```bash
git status --short
git diff --check
npm run lint
npm run typecheck
npm run test
npm run handoff:archive -- --dry-run
```

If scripts changed and have help modes, also run relevant help checks, for example:

```bash
npm run exports:process -- --help
npm run storage:cleanup -- --help
```

If code touches generated Prisma types or schema, also run:

```bash
npm run prisma:generate
npm run build
```

## Completion Protocol

1. Inventory affected scripts and docs.
2. Implement preferred secret input support/deprecation warnings.
3. Update active docs/runbooks and test docs.
4. Add tests/static checks.
5. Update remediation backlog and sprint index.
6. Move this optimized ticket to the appropriate `done/` folder.
7. Leave RB-113 open unless physical iPad evidence exists.
8. Commit the completed slice.
9. Ensure `npm run handoff:archive -- --dry-run` passes on a clean worktree.

## Notes For Codex

- This is a focused operations/security hygiene ticket.
- Do not implement RB-115-B unattended worker actor context here.
- Do not implement RB-116-A trial bootstrap attribution here unless only docs links are needed.
- Avoid changing authentication semantics.
- Do not print or log secrets in tests, warnings, errors, or snapshots.
- Prefer small backwards-compatible changes over a breaking operator workflow change.
