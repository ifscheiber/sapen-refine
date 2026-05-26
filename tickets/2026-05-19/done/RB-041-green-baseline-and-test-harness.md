# RB-041A — Green Validation Baseline and Test Harness

Status: Proposed  
Priority: High  
Type: Stabilization / Testing / Repo Hygiene  
Repository: `sapen-annotate`  
Depends on: RB-040 (`90acf9c chore: rename app to sapen-annotate and add repo docs baseline`)  
Blocks: RB-041 Architecture & UI Baseline, domain-model expansion, export, prediction handoff

---

## 1. Context

RB-040 completed the rename and documentation baseline, but the validation baseline is still red:

- `npm install`: passed
- `npx prisma generate`: passed
- `npm run lint`: fails on pre-existing issues
- `npm run build`: fails on a pre-existing TypeScript error in `src/app/app/AppShell.tsx:379`
- no root `typecheck` script exists
- no root `test` script exists
- manual browser smoke was not run
- worktree is clean after commit `90acf9c`

Before implementing RB-041 (architecture/UI baseline), SaPen Annotate needs a reliable validation baseline. Otherwise later refactors cannot distinguish newly introduced failures from existing debt.

This ticket is intentionally narrow: make the repository measurable and green enough for safe refactoring.

---

## 2. Goal

Establish a green, repeatable local validation baseline for SaPen Annotate.

At the end of this ticket, Codex and humans should be able to run a small set of root commands and know whether the current codebase is healthy.

Minimum expected commands:

```bash
npm run lint
npm run typecheck
npm run build
npm run test
```

If a command cannot be fully green for a legitimate reason, the limitation must be explicitly documented and isolated. However, the preferred outcome is a fully green baseline.

---

## 3. Scope

### In scope

1. Baseline-first inspection
   - Start with `git status --short`.
   - Confirm working tree cleanliness.
   - Run the existing validation commands before modifying code.
   - Capture the exact pre-existing failures in docs/backlog before fixing them.

2. Fix existing red baseline
   - Fix the current `npm run build` TypeScript error in `src/app/app/AppShell.tsx`.
   - Fix existing lint failures without broad unrelated refactors.
   - Avoid changing runtime behavior unless required to fix invalid code.

3. Add validation scripts
   - Add a root `typecheck` script.
   - Add a root `test` script.
   - Add focused sub-scripts if useful, e.g.:
     - `test:unit`
     - `test:integration`
     - `test:watch`
   - Prefer the existing stack and avoid adding heavy tooling unless necessary.

4. Establish minimal test harness
   - Add a minimal test framework setup if none exists.
   - Add at least smoke-level tests for stable, low-risk units.
   - Tests should prove the harness works and provide a seed for future coverage.
   - Good candidates:
     - app/config helpers
     - auth/session helper behavior
     - mask serialization/deserialization if currently present
     - API response helpers if present
     - pure utilities only; avoid brittle UI tests in this ticket.

5. Document the validation baseline
   - Add or update a docs page that explains:
     - available validation commands
     - what each command checks
     - how to run them locally
     - known limitations
   - Update remediation backlog by removing/resolving RB-040 baseline items that are now fixed.
   - Keep docs concise but navigable.

6. Commit discipline
   - Make focused commits after coherent slices:
     - baseline documentation / scripts
     - lint/build fixes
     - test harness
   - Each commit message must be descriptive.

---

## 4. Out of scope

Do not implement these in this ticket:

- App shell redesign
- Design token refactor
- Dark/light mode implementation
- Domain model redesign
- T-number or acquisition metadata model
- Admin export
- Prediction/handoff workflow
- Mask format migration
- Large UI refactor
- Authentication redesign
- Database schema changes unless absolutely required to fix validation

If such issues are discovered, add structured backlog entries instead of expanding scope.

---

## 5. Implementation guidance

### 5.1 Baseline-first workflow

Codex must begin with:

```bash
git status --short
npm install
npx prisma generate
npm run lint
npm run build
```

If scripts are missing, document that before adding them.

After adding `typecheck` and `test`, run:

```bash
npm run lint
npm run typecheck
npm run build
npm run test
```

### 5.2 Typecheck script

Prefer a straightforward TypeScript validation script consistent with the existing repo.

Examples:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

If Next build already performs typechecking, still add `typecheck` because it is faster and clearer for Codex/test gating.

### 5.3 Test framework

If the repository already contains a test framework, reuse it.

If none exists, prefer a lightweight setup appropriate for a Next/TypeScript app, for example Vitest for unit/integration-style tests. Keep configuration minimal.

Do not add Playwright/E2E in this ticket unless already present and trivial to wire.

### 5.4 First tests

Initial tests should be intentionally modest and robust.

They should test stable code that is unlikely to be deleted during RB-041. Avoid tests against prototype UI structure that is expected to change.

Good first tests:
- pure serialization helpers
- route response/header helpers
- validation helpers
- storage key builders
- auth/session utility functions where mockable

Bad first tests:
- screenshot tests
- brittle DOM tests
- broad browser E2E
- tests that require real external services
- tests that depend on unstable prototype pages

---

## 6. Acceptance criteria

This ticket is complete when:

1. `git status --short` is clean before final response.
2. Root scripts exist:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
   - `npm run test`
3. The root validation commands either pass or any remaining failure is:
   - unavoidable within this ticket,
   - isolated,
   - documented with exact command/output summary,
   - and added to the remediation backlog.
4. The current known TypeScript build failure in `src/app/app/AppShell.tsx:379` is fixed.
5. Existing lint failures from RB-040 baseline are fixed or explicitly documented if deferred.
6. A minimal test harness exists and is proven by at least one passing test file.
7. Documentation explains the validation commands and test strategy.
8. Remediation backlog is updated to reflect resolved baseline issues.
9. At least one focused commit is created for the completed work.
10. The final Codex report includes:
    - commits created,
    - commands run,
    - pass/fail status,
    - any remaining known gaps,
    - files changed summary.

---

## 7. Suggested final validation command block

```bash
git status --short
npx prisma generate
npm run lint
npm run typecheck
npm run build
npm run test
```

Optional if available:

```bash
npm run check:docs-links
```

---

## 8. Suggested commit messages

Examples:

```bash
git commit -m "test: add validation scripts and unit test harness"
git commit -m "fix: restore green lint and build baseline"
git commit -m "docs: document validation baseline"
```

Use fewer or more commits as appropriate, but do not mix unrelated work into one large commit.
