# Coordinate Spaces And Transforms

## Purpose

This page defines the coordinate-space vocabulary for crop-based slice annotation.

Current runtime behavior still saves full-resolution masks in image-sized `IMAGE_PIXEL` coordinate space. RB-086 adds runtime `SOURCE_IMAGE_PIXEL` persistence for BBox proposal versions. Crop masks and `CROP_PIXEL` remain planned for later schema/API/editor/export tickets.

## Coordinate Spaces

### SOURCE_IMAGE_PIXEL

`SOURCE_IMAGE_PIXEL` means pixel coordinates on the immutable uploaded image.

Properties:

- origin is the top-left source image pixel,
- `x` increases right,
- `y` increases down,
- valid source pixels satisfy `0 <= x < sourceWidth` and `0 <= y < sourceHeight`,
- source image checksum and dimensions are part of provenance.

`SOURCE_IMAGE_PIXEL` is the implemented persisted coordinate value for RB-086 `SliceBoundingBoxVersion` rows. Current full-resolution mask artifacts still use `IMAGE_PIXEL`.

### CROP_PIXEL

`CROP_PIXEL` means pixel coordinates inside a derived crop image. It is still a design term; the active Prisma enum does not persist crop-mask artifacts in `CROP_PIXEL` yet.

Properties:

- origin is the top-left crop pixel,
- `x` increases right,
- `y` increases down,
- valid crop pixels satisfy `0 <= x < cropWidth` and `0 <= y < cropHeight`,
- crop pixels map to source pixels through the crop transform.

## Crop Transform

The base transform is:

```text
sourceX = cropX + cropOriginX
sourceY = cropY + cropOriginY
```

The inverse transform for source pixels inside the crop is:

```text
cropX = sourceX - cropOriginX
cropY = sourceY - cropOriginY
```

`cropOriginX` and `cropOriginY` are stored in `SOURCE_IMAGE_PIXEL`. `cropWidth` and `cropHeight` are stored in `CROP_PIXEL`. The transform should be identified by a stable transform name or version in persisted metadata and export manifests so future non-translation transforms cannot be confused with this first integer offset model.

## Padding

Padding is requested around a BBox proposal to give annotators visual context.

The crop artifact should record:

- requested padding,
- resolved crop origin,
- resolved crop width and height,
- whether the crop was clipped by source-image boundaries,
- any representation of out-of-source padded pixels if future implementations allow padded pixels beyond the source image.

For the first implementation, prefer clipping crops to source-image bounds. That keeps every `CROP_PIXEL` coordinate mappable to a real `SOURCE_IMAGE_PIXEL` coordinate and avoids introducing synthetic image pixels into training exports.

## Bounds And Rounding

Crop transforms must be integer-pixel transforms for the first implementation.

Rules:

- RB-086 BBox proposal coordinates are normalized to integer source pixels before persistence.
- BBox proposals must satisfy `x >= 0`, `y >= 0`, `width >= 4`, `height >= 4`, `x + width <= sourceWidth`, and `y + height <= sourceHeight`.
- Crop origin and dimensions must be non-negative integers after clipping.
- Empty crops are invalid.
- The crop rectangle must satisfy `0 <= cropOriginX < sourceWidth`, `0 <= cropOriginY < sourceHeight`, `cropOriginX + cropWidth <= sourceWidth`, and `cropOriginY + cropHeight <= sourceHeight`.
- Masks in `CROP_PIXEL` must match the derived crop dimensions exactly.
- Reprojection to `SOURCE_IMAGE_PIXEL` must clip to source image bounds.

## Reprojection

Reprojection maps crop masks back into source-image coordinate space.

For each crop mask pixel:

```text
target[sourceY, sourceX] = cropMask[cropY, cropX]
```

where:

```text
sourceX = cropX + cropOriginX
sourceY = cropY + cropOriginY
```

If multiple crop masks overlap in a future multi-slice workflow, conflict policy must be explicit in the export ticket. RB-085 does not define automatic conflict resolution.

## Manifest Requirements

Any crop-aware manifest entry must include:

- source coordinate space,
- crop coordinate space,
- source image id,
- source image checksum,
- source image dimensions,
- crop origin,
- crop dimensions,
- padding metadata,
- transform formula or transform version,
- whether requested padding was clipped by source-image boundaries,
- artifact version ids for crop image, support mask, semantic mask, and classification where applicable.

## Related Docs

- [crop-based-slice-annotation.md](crop-based-slice-annotation.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [training-export-contract.md](training-export-contract.md)
