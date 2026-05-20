# RB-062 - Editor Mask Fetch Abort On Open

## Status

Completed

## Priority

High

## Type

Bugfix / Editor / Browser Stability / Tests

## Context

After uploading an image and clicking `Open Editor`, the editor opens but the browser console reports:

```text
Uncaught (in promise) DOMException: The operation was aborted.
useEffect EditorClient.tsx:662
```

The stack points at editor startup cleanup aborting an in-flight latest-mask fetch. This should be treated as an expected cancellation, not as an unhandled promise rejection.

While investigating the same uploaded-image path, the image list also shows missing T-number twice: once as the explicit `T-number: missing` pill and once in the metadata summary pill. Missing T-number is not the cause of the abort error, but the duplicate signal should be cleaned up in the same small browser-stability slice.

## Goal

Opening the editor after upload must not emit an uncaught promise rejection when the early latest-mask fetch is aborted by cleanup, route changes, React development remounts, or mode switches.

## Scope

- Inspect the editor image-load and latest-mask fetch effects.
- Swallow expected `AbortError`/aborted fetch cancellations.
- Preserve real error reporting for non-abort latest-mask failures.
- Avoid duplicate `Missing T-number` pills in the project image list.
- Add or update focused coverage where practical.
- Run relevant validation and full lightweight gates.
- Move this ticket to `tickets/2026-05-20/done/` when complete.

## Acceptance Criteria

- Editor startup no longer logs `Uncaught (in promise) DOMException: The operation was aborted`.
- Real latest-mask fetch failures still surface as normal errors or status where applicable.
- The image list shows missing T-number once for an image without sample metadata.
- Existing desktop browser E2E remains green.
- Relevant docs/test notes are updated if coverage changes.
