# RB-055 - Upload Artifact Validation And Checksum Hardening

## Status

Proposed

## Priority

High

## Type

Storage / API Hardening / Data Integrity

## Depends on

- RB-049 - Annotation Domain Schema Implementation

## Goal

Harden raw image and annotation artifact writes so stored objects are trustworthy training-data inputs.

## Scope

- Validate object existence and metadata after upload.
- Record and verify checksums for raw images and annotation artifacts.
- Validate image dimensions and mask dimensions/coordinate space.
- Ensure content type and size are consistent with configured limits.
- Add audit events for upload/commit actions.
- Update storage, API, and backup/export docs.

## Non-Goals

- High-availability storage.
- Full malware scanning.
- External object storage migration.

## Acceptance Criteria

- Image and artifact commit paths record checksum and validated dimensions.
- Oversized or inconsistent uploads fail with stable API errors.
- Audit records identify actor, project, image/artifact, and action.
- Validation baseline remains green.
