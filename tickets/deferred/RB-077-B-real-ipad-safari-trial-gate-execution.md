# RB-077 - Real iPad Safari Trial Gate Execution

## Status

Deferred / Manual Gate

## Priority

Medium

## Type

iPad Validation / Customer Trial Gate

## Context

The app has automated desktop and iPad viewport preparation tests, but real iPad Safari behavior has not been validated because deployment/device access was unavailable.

Canvas-based annotation, file upload, Apple Pencil behavior, viewport sizing, scrolling, and Home Screen mode can differ from desktop browsers.

Deferred trigger: move this ticket back into the active dated ticket folder only after a deployed HTTPS trial URL, named tester account, physical iPad/Safari access, and optional Apple Pencil are available.

## Goal

Execute the real iPad Safari manual smoke gate against a deployed trial URL.

## Requirements

- Use the existing manual iPad Safari gate checklist.
- Verify login, project navigation, image upload, metadata, editor open, semantic drawing, support drawing, save/reload, review, export visibility, rotation, and Home Screen behavior where applicable.
- Capture device/browser/version details.
- Record pass/fail evidence and convert defects into tickets.

## Non-Goals

- Do not implement advanced gestures in this ticket unless the gate fails and a separate fix ticket is created.
- Do not mark iPad readiness complete without real device evidence.
- Do not broaden the test to unsupported browsers unless explicitly requested.

## Acceptance Criteria

- Real iPad Safari smoke result is documented.
- Any failed steps have reproducible notes and follow-up tickets.
- Customer trial readiness summary is updated with the real gate status.

## Validation

- Manual iPad Safari gate.
- Existing `npm run test:e2e:ipad-prep` remains green.

