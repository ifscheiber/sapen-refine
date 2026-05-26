# SCNN-001 - Instance Segmentation Integer Mask Loader Contract

## Repository

`sapen-cnn`

## Context

`sapen-annotate` will materialize crop-derived source-image instance masks as 32-bit
integer TIFF mode `I`. This avoids the unsafe 8-bit PNG path where instance ids can be
normalized before conversion to `long`.

Read-only inspection during the Annotate export sprint found that
`models/sapen_instseg/data/dataset.py` normalizes common Pillow integer modes in the
default loader. Mode `I` is the desired contract because ids must remain exact integers.

## Goal

Make the `sapen_instseg` dataset loader explicitly support integer-preserving instance
mask files produced by `sapen-annotate`.

## Acceptance Criteria

- The instance mask loader preserves ids `0..N` exactly for the chosen TIFF mode.
- A focused test covers ids greater than `255`.
- Loader docs/runbooks mention the Annotate materializer output.
- Training configs continue to use matching image/mask stems.
- No fallback to normalized 8-bit PNG instance ids is introduced.
