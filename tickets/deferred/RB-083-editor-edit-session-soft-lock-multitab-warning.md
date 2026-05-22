# RB-083 - Editor Edit Session / Soft Lock / Multi-Tab Warning

## Status

Deferred / Backlog

## Priority

P2

## Context

RB-081 documents that the trial should not hard-block multiple editor tabs. However, full-resolution editing can use substantial browser memory, especially near the `8000x6000` trial upper bound and on iPad.

Ground-truth mask saves are append-only, so a second tab should not silently overwrite an approved or historical version. Still, multiple tabs on the same image can confuse annotators about which working copy is current and can increase memory pressure.

Deferred trigger: reactivate when real iPad/customer usage or prioritization shows multi-tab confusion or memory pressure is a near-term trial problem.

## Goal

Add a user-friendly edit-session warning that detects likely duplicate editor tabs without hard-blocking normal annotation work.

## Desired Behavior

- Warn when the same image is open in more than one editor tab in the same browser profile.
- Prefer local browser signaling first, for example `BroadcastChannel` or `localStorage`, before adding server-visible locks.
- Do not prevent saving solely because another tab exists.
- Keep server-side append-only mask versioning as the source of truth.
- For very large images, display a stronger memory warning when more than one editor tab is detected.

## Non-Goals

- No hard exclusive lock.
- No distributed lock or queue.
- No overwrite semantics.
- No schema change unless a later server-side soft-lock design explicitly requires it.

## Documentation

Update editor and known-gap docs when implemented.
