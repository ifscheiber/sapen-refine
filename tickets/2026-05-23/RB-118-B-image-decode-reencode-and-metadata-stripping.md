# RB-118-B - Image Decode/Re-Encode And Metadata Stripping

## Status

Planned

## Priority

P2 before public or broad untrusted raw-image upload exposure

## Type

Security / Image Processing / Provenance

## Source

- `docs/08-adr/ADR-008-upload-content-safety.md`
- RB-118 follow-up

## Goal

Normalize accepted raw image uploads through controlled decode/re-encode and metadata stripping before durable storage promotion.

## Requirements

- Decode supported PNG/JPEG uploads with a controlled server-side image library.
- Re-encode to approved internal output formats and strip EXIF/embedded metadata by default.
- Record provenance for original checksum/size and normalized checksum/size without exposing raw metadata values.
- Preserve trial dimension limits and existing stable upload errors where applicable.

## Acceptance Criteria

- Malformed images fail with sanitized stable errors.
- Normalized objects have recorded checksum, size, dimensions, and content type.
- Embedded metadata values are not logged or returned.
- Tests cover decode failure, metadata stripping, and provenance fields.
