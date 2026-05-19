# ADR-002 - Desktop Browser First, Real iPad Validation Deferred

## Status

Accepted for RB-047.

## Context

SaPen Annotate must support both desktop browsers and iPad Safari. RB-046 prepared deployment and iPad browser identity, but a real Strato/customer-trial deployment and real iPad Safari device access are not currently available.

Blocking all MVP browser validation on unavailable iPad execution would delay the next baseline unnecessarily. At the same time, iPad support remains a first-class product requirement because annotation work is expected to happen on smaller tablet screens as well as PC browsers.

## Decision

Proceed with the desktop browser MVP path first in RB-047:

- automate the current desktop browser smoke path where feasible,
- continue documenting and preparing iPad validation,
- do not treat Chromium iPad viewport checks as a replacement for real iPad Safari,
- keep layout, input, and route choices compatible with later iPad execution,
- require real iPad Safari smoke before any customer pilot.

## Consequences

- Desktop browser regressions can be caught earlier by Playwright.
- Real iPad Safari behavior remains an explicit deferred gate, not an implicit assumption.
- Future tickets must not introduce desktop-only interaction patterns that make iPad support harder.
- Customer pilot readiness still depends on executing and passing the real iPad smoke checklist.
