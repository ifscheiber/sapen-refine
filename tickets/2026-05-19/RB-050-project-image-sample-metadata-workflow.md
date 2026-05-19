# RB-050 - Project, Image, And Sample Metadata Workflow

## Status

Proposed

## Priority

High

## Type

API / UI / Metadata / Trial Workflow

## Depends on

- RB-049 - Annotation Domain Schema Implementation

## Goal

Add the minimal workflow for project-level settings, image asset validation, acquisition metadata, and sample/specimen metadata.

## Scope

- Capture and persist image dimensions, checksum, content type, byte size, and validation state.
- Add structured acquisition metadata fields where the schema supports them.
- Add sample/specimen fields including T-number, slice index, replicate, treatment/reference, and notes.
- Keep the browser workflow usable on desktop and iPad-sized screens.
- Update API docs, image feature docs, and testing docs.

## Non-Goals

- Full lab LIMS integration.
- Training export implementation.
- Advanced metadata import automation beyond simple EXIF/structured fields if not already available.

## Acceptance Criteria

- Users can add/edit required project/image/sample metadata for the MVP workflow.
- Image metadata is attributable and server-validated where practical.
- Missing metadata is visible to later export/readiness checks.
- Desktop browser smoke remains green.
