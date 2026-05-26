# RB-116-A - Trial Bootstrap Operator Attribution (Optimized Post-RB-117)

## Status

Planned

## Priority

P3 before treating bootstrap scripts as production operations; P2 if trial bootstrap is used for customer-facing admin setup

## Type

Audit / Operator Attribution / CLI Hardening / Bootstrap Scripts / Tests

## Source

- Completed RB-116 audit coverage matrix and guard.
- `docs/testing/audit-coverage-matrix.md`
- Completed RB-115-A: structured `details.actorContext`.
- Completed RB-117: shared secret input helper and CLI password deprecation.
- Original follow-up: `RB-116-A-trial-bootstrap-operator-attribution.md`
- Relevant scripts:
  - `scripts/trial-bootstrap.mjs`
  - `scripts/create-trial-user.mjs`
  - `scripts/trial-bootstrap-lib.mjs`

## Depends On

- RB-117 is complete and provides the current preferred operator secret input mechanisms:
  - `--password-file`
  - `*_PASSWORD_FILE`
  - `*_PASSWORD`
  - `--password-stdin`
  - deprecated `--password`
  - shared helper `scripts/secret-input.mjs`
- RB-115-A is complete and provides structured `details.actorContext`.
- RB-116 is complete and classifies trial bootstrap scripts as partial audit coverage.
- RB-113 remains open and must not be completed or modified by this ticket.

## Blocks

- Treating trial bootstrap and trial-user scripts as production/customer-facing operational tooling.
- Marking trial bootstrap audit coverage as sufficient in the RB-116 matrix.

## Context

RB-116 classified the trial bootstrap scripts as partial audit coverage.

The scripts can create or update:

- trial roles,
- label schema,
- users,
- global roles,
- project membership,
- audit rows.

That is acceptable for local development/bootstrap setup, but it is not sufficient for customer-facing operational administration if the scripts do not require or record an explicit operator/system actor context.

RB-117 is now complete, so RB-116-A should use the current documented operator secret mechanism instead of introducing new password handling or recommending command-line passwords.

RB-115-A is also complete, so RB-116-A should use the established structured `details.actorContext` shape for audit rows.

## Goal

Add explicit non-anonymous operator attribution to trial bootstrap and trial-user scripts before those scripts are treated as production operational tooling.

The goal is not to turn bootstrap scripts into a full admin product. It is to ensure that any audit-relevant bootstrap writes have a clear, non-secret, structured actor context.

## Non-Goals

- Do not build an admin UI.
- Do not redesign bootstrap flows.
- Do not implement RB-115-B unattended worker actor context.
- Do not implement RB-115-C Core handoff provenance.
- Do not weaken local development ergonomics.
- Do not store passwords, tokens, raw headers, signed URLs, or secrets in audit logs.
- Do not recommend `--password` in docs or examples.
- Do not complete or fabricate RB-113 iPad evidence.

## Required Investigation

Inspect current behavior in:

- `scripts/trial-bootstrap.mjs`
- `scripts/create-trial-user.mjs`
- `scripts/trial-bootstrap-lib.mjs`
- current audit helper(s)
- `docs/testing/audit-coverage-matrix.md`
- docs/runbooks that mention bootstrap or trial user creation.

Determine:

- Which audit rows are written by each script.
- Whether `TRIAL_BOOTSTRAP` and `TRIAL_USER_UPSERT` already contain actor context.
- Whether an operator email/id is available in current command args or env.
- Whether scripts run locally/dev-only or are documented for customer-trial setup.
- How RB-117 secret input helper is currently used by `create-trial-user`.
- Whether `trial-bootstrap` needs authentication or only explicit attribution.

## Requirements

### 1. Operator Identity Input

Add a clear way to provide operator identity for bootstrap scripts.

Possible inputs, in preferred order:

1. explicit operator email/user id env var, for example `SAPEN_OPERATOR_EMAIL`;
2. explicit CLI option for operator identity, for example `--operator-email`, if consistent with repo CLI conventions;
3. documented local-dev fallback such as `system:local-bootstrap`, only when explicitly allowed.

Do not require passwords for pure local/dev bootstrap if the script does not need authentication. If a script authenticates as an operator, use RB-117 secret handling.

### 2. Actor Context For Audit Rows

Ensure audit rows written by bootstrap scripts include structured actor context aligned with RB-115-A.

At minimum:

- `triggeredBy.type`: `OPERATOR` or `SYSTEM`
- `triggeredBy.label`: operator email/id or explicit system label
- `performedBy.type`: `SCRIPT` or the repo's chosen equivalent
- `performedBy.label`: `trial-bootstrap` or `create-trial-user`
- optional `processorRunId` or script run id if already available or easy to add

Preserve existing `AuditLog.actorId` behavior if it is already used.

### 3. Local Development Ergonomics

Preserve easy local bootstrap setup.

If no operator identity is supplied in local/dev mode:

- either fail only in production/customer-trial mode,
- or use an explicit documented local system actor such as `system:local-bootstrap`.

The behavior must be documented clearly so this fallback cannot be mistaken for a production operations model.

### 4. Secret Safety

Ensure actor context and audit details never contain:

- passwords,
- tokens,
- raw auth headers,
- signed URLs,
- file secret paths if those paths are sensitive,
- environment variable values.

### 5. Matrix Update

Update `docs/testing/audit-coverage-matrix.md`:

- change trial bootstrap rows from `partial` to `sufficient` only after tests prove attribution is present;
- otherwise keep them partial and document exactly what remains.

### 6. Documentation

Update active bootstrap/operator docs to explain:

- how to provide operator identity,
- how local-dev fallback works,
- how customer-trial/prod usage should be run,
- that `--password` is deprecated and RB-117 secret mechanisms should be used when credentials are required.

Do not update historical completed tickets except where a current index/link requires it.

### 7. Tests

Add or update tests for:

- `TRIAL_BOOTSTRAP` audit row includes non-anonymous actor context.
- `TRIAL_USER_UPSERT` audit row includes non-anonymous actor context.
- local-dev fallback is explicit and documented, if supported.
- production/customer-trial mode without operator identity fails or records an explicit system actor according to the chosen policy.
- audit payload does not include secrets.
- RB-116 audit matrix/guard remains green.

## Acceptance Criteria

- `TRIAL_BOOTSTRAP` audit rows have non-anonymous operator or explicit system actor context.
- `TRIAL_USER_UPSERT` audit rows have non-anonymous operator or explicit system actor context.
- Tests cover both scripts' audit payload shape without recording secrets.
- Active docs use RB-117 secret mechanisms where credentials are needed.
- `docs/testing/audit-coverage-matrix.md` is updated truthfully.
- Local development bootstrap remains usable.
- No `--password` examples are reintroduced in active docs.
- RB-113 remains open unless real physical iPad evidence was provided separately.
- Worktree is clean and handoff dry-run passes.

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

If bootstrap scripts expose help output, also run relevant help checks, for example:

```bash
node scripts/trial-bootstrap.mjs --help
node scripts/create-trial-user.mjs --help
```

If schema/generated Prisma types are touched, also run:

```bash
npm run prisma:generate
npm run build
```

## Completion Protocol

1. Implement operator/system actor attribution for bootstrap audit rows.
2. Update tests and audit coverage matrix.
3. Update active docs/runbooks.
4. Move this optimized ticket to the appropriate `done/` folder.
5. Leave RB-113 open unless physical iPad evidence exists.
6. Commit the completed slice.
7. Ensure `npm run handoff:archive -- --dry-run` passes on a clean worktree.

## Notes For Codex

- Use the RB-117 secret helper/mechanisms; do not invent new password handling.
- Use the RB-115-A `details.actorContext` shape.
- Keep this focused on bootstrap/trial-user scripts.
- Do not implement unattended worker attribution or Core handoff provenance here.
