# RB-077 — Real iPad Safari Trial Gate Preparation & Deferred Execution Tracking

## Status

Implemented

## Priority

High

## Type

iPad Validation / Trial Gate Preparation / Ticket Hygiene / Deferred Backlog / Documentation

## Repository

`sapen-annotate`

## Depends on

- RB-076 — Customer Trial Deployment Dry Run, if already executed
- RB-069 — Customer Trial Deployment, Handoff Hygiene & iPad Safari Gate
- RB-080/RB-081 — Full-resolution mask upload hotfixes, if already executed

## Blocks

- Real customer iPad Safari readiness sign-off
- RB-078 — Post-Trial Findings / Triage
- Customer-facing iPad annotation confidence

---

## 1. Context

The app has automated desktop and iPad-viewport preparation tests, but real iPad Safari behavior has not yet been validated on a physical device against a deployed trial URL.

The existing RB-077 goal is to execute the real iPad Safari manual smoke gate. However, Codex cannot execute that gate without:

- a deployed trial URL,
- physical iPad access,
- Safari / iPadOS device details,
- optional Apple Pencil availability,
- manual observation of canvas/touch/scroll behavior.

Therefore RB-077 must **not** be marked as fully passed by Codex unless real manual evidence is provided.

This ticket turns RB-077 into a preparation and tracking slice:

1. Prepare the iPad Safari gate so a human can execute it.
2. Create a clear deferred-ticket structure under `tickets/`.
3. Move currently open/future/manual tickets that cannot be executed now into that deferred/backlog structure.
4. Update docs/backlog so the future/manual status is explicit.
5. Leave the actual real-device execution pending until deployment/device access exists.

Implementation result:

- `tickets/deferred/` now separates non-actionable/manual-gate work from active dated tickets.
- The real iPad Safari execution gate is tracked as `tickets/deferred/RB-077-B-real-ipad-safari-trial-gate-execution.md`.
- RB-078 post-trial triage and RB-083 edit-session/multi-tab warning are deferred.
- RB-084 remains active because it is a concrete deployment hardening follow-up from RB-076.
- Real iPad Safari status remains pending; no pass/fail result is claimed without physical-device evidence.

---

## 2. Goal

Make the real iPad Safari validation gate ready for manual execution and cleanly track all deferred/future tickets.

At the end of RB-077:

1. The real iPad Safari gate checklist is complete, executable and current.
2. The ticket system clearly separates:
   - active/current tickets,
   - done tickets,
   - deferred/future/manual-gate tickets.
3. A new `tickets/deferred/` or equivalent folder exists.
4. Future tickets such as post-trial triage and not-yet-started larger product sprint tickets are moved into the deferred/backlog area where appropriate.
5. Docs and backlog files reference the deferred tickets.
6. The real iPad Safari gate status is explicitly marked as pending unless the user supplies real test evidence.
7. No product behavior changes are introduced.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- real iPad Safari execution without physical device evidence,
- fake pass/fail results,
- advanced iPad gestures,
- editor fixes,
- product features,
- deployment changes,
- crop-based annotation sprint implementation,
- post-trial triage,
- customer feedback triage,
- bug fixes discovered only as theoretical risks.

If a blocker is already known and reproducible, create a separate focused ticket.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Start with the full validation baseline unless this is purely docs/ticket movement and repo convention allows a narrower gate:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

If Codex chooses a narrower validation gate because only docs/ticket files changed, it must justify this in the final report. For customer-trial gate docs, prefer the full validation gate.

---

## 5. Ticket Folder / Backlog Hygiene

### 5.1 Create deferred folder

Create a clear folder for future/manual/deferred work:

```text
tickets/deferred/
```

Add:

```text
tickets/deferred/README.md
```

The README should explain:

- what belongs there,
- how deferred tickets return to active work,
- difference between `done/`, active ticket folders and `deferred/`,
- that manual-gate tickets cannot be marked done without evidence.

### 5.2 Move deferred tickets

Inspect current `tickets/` state.

Move tickets that are not actionable now into `tickets/deferred/` or a dated subfolder under it.

Likely candidates:

```text
RB-078 — Post-Trial Findings / Triage
future crop-based annotation sprint tickets such as RB-083 through RB-090 if present
real execution-only iPad gate follow-up if split out
any other Proposed/Future tickets not intended for immediate implementation
```

Do not move:

- active hotfixes currently being implemented,
- completed tickets in `done/`,
- the current RB-077 preparation ticket until completed,
- tickets intentionally active for the current sprint.

### 5.3 Optional split

Codex may split RB-077 into:

```text
RB-077-A — iPad Safari Gate Preparation
RB-077-B — Real iPad Safari Gate Execution
```

If splitting:

- RB-077-A is the current implementable ticket.
- RB-077-B must go to `tickets/deferred/` until deployment/device access exists.
- Docs must clearly reference RB-077-B as the manual execution gate.

If not splitting, RB-077 itself may remain active until manual execution. Preferred for repo hygiene: split preparation and execution.

### 5.4 Backlog references

Update:

```text
docs/adr/remediation-backlog.md
docs/known-gaps.md
docs/00-overview/customer-trial-readiness.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
```

Docs must list:

- deferred manual iPad execution ticket,
- post-trial triage ticket,
- crop-based annotation sprint tickets if present,
- status and trigger for each deferred item.

---

## 6. iPad Safari Gate Preparation

Update or create:

```text
docs/07-testing/manual-smoke-ipad-safari-gate.md
```

The checklist must be executable against a deployed trial URL.

Required sections:

### 6.1 Environment

```text
Deployed URL:
Date:
Tester:
iPad model:
iPadOS version:
Safari version:
Apple Pencil available: yes/no
Network:
Trial user:
Role:
```

### 6.2 Preconditions

- deployed trial URL is reachable,
- named trial user exists,
- no shared demo account,
- at least one project exists,
- at least one image exists or upload test will create one,
- backup not required for test dataset or backup already taken.

### 6.3 Test steps

Include pass/fail/notes rows for:

```text
login
project overview
images route
image upload
metadata edit
editor open
semantic drawing
eraser tool
support drawing
slice classification
save/reload
review/approval if role permits
training export visibility/download if role permits
prediction task/correction if fixture exists
large full-resolution mask save if fixture exists
rotation portrait/landscape
canvas scroll blocking while drawing
page scroll outside canvas
Apple Pencil if available
Home Screen / PWA launch if applicable
logout
```

### 6.4 Result classification

Each failed step should be classified:

```text
BLOCKER
MAJOR
MINOR
OBSERVATION
```

### 6.5 Evidence

Require:

- short notes,
- optional screenshot/photo,
- console/network notes if available,
- follow-up ticket id.

### 6.6 Gate status

Docs must clearly state:

```text
Real iPad Safari Gate status: PENDING until this checklist is executed on a physical iPad against a deployed trial URL.
```

Do not mark it passed unless the user provides actual results.

---

## 7. Docs / Current State Updates

Update:

```text
docs/00-overview/current-state.md
docs/00-overview/customer-trial-readiness.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/adr/remediation-backlog.md
docs/known-gaps.md
README.md if needed
```

Docs must distinguish:

```text
automated desktop/browser validation — implemented
iPad viewport preparation — implemented if true
real iPad Safari execution — pending
deployment dry run — status according to RB-076
post-trial triage — deferred
crop-based annotation sprint — deferred/future
```

---

## 8. Tests / Validation

No product tests are required unless docs tooling or route references change.

If available, run:

```bash
npm run test:e2e:ipad-prep
```

If not available, document that viewport preparation is covered by current E2E or deferred.

At minimum, final validation should include:

```bash
git status --short
npm run lint
npm run typecheck
npm run test
npm run handoff:archive -- --dry-run
```

Preferred full gate:

```bash
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

---

## 9. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean.
2. `tickets/deferred/` or equivalent exists with README.
3. Future/manual/non-actionable tickets are moved into the deferred folder where appropriate.
4. Active ticket folders no longer contain tickets that are explicitly future/manual-only.
5. iPad Safari manual gate checklist is complete and executable.
6. Real iPad Safari status is marked pending unless real test evidence exists.
7. Backlog/current-state/customer-readiness docs reference deferred tickets.
8. No product behavior changes are introduced.
9. If RB-077 is split, preparation ticket is done and execution ticket is deferred.
10. Ticket is moved to:

```text
tickets/2026-05-21/done/
```

or, if split:

```text
tickets/2026-05-21/done/RB-077-A-...
tickets/deferred/RB-077-B-...
```

11. Final Codex report includes:
    - tickets moved,
    - deferred folder created,
    - docs updated,
    - iPad gate status,
    - validation commands run,
    - pass/fail status,
    - next manual action for the user.

---

## 10. Suggested Commit Sequence

```bash
git commit -m "docs: prepare ipad safari gate execution"
git commit -m "chore: add deferred ticket backlog folder"
git commit -m "docs: move manual and future tickets to deferred backlog"
git commit -m "docs: update customer trial gate status"
git commit -m "chore: finalize ipad safari gate preparation ticket"
```

---

## 11. Notes for Codex

- Do not mark real iPad Safari as passed without evidence.
- Prefer splitting preparation and execution if that keeps ticket status honest.
- Deferred does not mean cancelled; it means not actionable until trigger conditions exist.
- Keep docs short but explicit.
