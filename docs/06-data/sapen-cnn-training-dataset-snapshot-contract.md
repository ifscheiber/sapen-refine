# SaPen-CNN Training Dataset Snapshot Contract

## Purpose

This document defines the `sapen-annotate` to `sapen-cnn` training-data handoff contract.
It is a manifest-backed dataset snapshot, not a training runner and not a SaPen Core handoff.

The current implementation work happens in `sapen-annotate`. The adjacent `../sapen-cnn`
repository is a read-only compatibility reference for this sprint.

Evidence checked in `../sapen-cnn`:

- `../sapen-cnn/models/sapen_instseg/data/dataset.py`
- `../sapen-cnn/models/sapen_clsf/dataset.py`
- `../sapen-cnn/models/sapen_semseg/data/dataset.py`
- `../sapen-cnn/configs/instseg/dinov2_frozen.json`
- `../sapen-cnn/configs/clsf/slice_stain_resnet18.json`
- `../sapen-cnn/configs/semseg/heartwood_sapwood_instance_patches_dinov2_multiscale.json`
- `../sapen-cnn/configs/semseg/copper_binary_instance_patches_dinov2.json`
- `../sapen-cnn/docs/runbooks/instseg.md`
- `../sapen-cnn/docs/runbooks/classification.md`
- `../sapen-cnn/docs/runbooks/semseg.md`

## Snapshot Identity

Logical/API target:

```text
sapen_cnn_training
```

Manifest version:

```text
sapen-annotate-cnn-training-dataset-v1
```

The snapshot may be persisted internally as `ExportTarget.COMBINED_MANIFEST`, but it must
not be confused with the existing `combined` export. Runtime code must branch by
`metadataSummary.logicalTarget = "sapen_cnn_training"` and/or the manifest format version.
Existing combined-manifest exports keep their current contract.

The primary handoff is manifest-only plus direct object-store materialization. ZIP packages
remain for existing training exports and manual audit/download paths.

## Public Manifest And Private Refs

The public manifest is safe to download through the existing export download path. It must
not contain buckets, storage keys, access keys, or signed URLs.

Public object references contain:

```text
objectRefId
role
checksum
size
dimensions
format
coordinateSpace
labelSchemaVersionId
```

Private materialization refs are resolved through a separate audited operator path and map:

```text
objectRefId -> storageKey/source
```

Normal export summaries, public manifests, and package downloads must not expose
`metadataSummary.objectSources` or any raw object-storage location.

## Manifest Shape

Top-level fields:

```text
manifestVersion
snapshotId/exportId
createdAt
createdBy
project
selection
labelSchemas
splitPolicy
objectAccess
fullImageItems
classificationItems
cropSemanticItems
skippedItems
warnings
summary
```

`splitPolicy` records the deterministic split method, the seed/hash strategy, and a
`groupSplitMap` summary. Every item also records its own `groupKey` and `split`.

## Split Policy

Create one deterministic group split map per export and apply it consistently to:

- `fullImageItems`
- `classificationItems`
- `cropSemanticItems`

Group key:

```text
sampleMetadata.tNumber + specimenIdentifier if present
else sourceImageId
```

Default split:

```text
train: 0.8
val: 0.2
```

All items from the same group must land in the same split across dataset families.

## Dataset Families

### Full-Image Instance Segmentation

`fullImageItems[]` are whole-source-image instance-segmentation samples reconstructed
from approved crop support geometry in source-image pixel space.

They are not classification items.

Required fields include:

```text
sourceImage.id
sourceImage.filename
sourceImage.objectRefId
sourceImage.contentType
sourceImage.size
sourceImage.width
sourceImage.height
sourceImage.checksum
sourceImage.sampleMetadata
sourceImage.acquisitionMetadata
instanceMask.derivation = CROP_REPROJECTED_SUPPORT_GEOMETRY
instanceMask.format = tiff-i32
instanceMask.coordinateSpace = SOURCE_IMAGE_PIXEL
instanceMask.width
instanceMask.height
instanceMask.sourceCropIds[]
instanceMask.sourceSliceInstanceIds[]
instanceMask.instanceIdMap[]
sourceCropRefs[]
groupKey
split
warnings[]
```

Instance ids:

```text
0 = background
1..N = crop-derived slice instances sorted by sourceY, sourceX, sliceInstanceId, cropId
```

Support geometry rules:

- Copper crops require an approved explicit crop `SLICE_SUPPORT_MASK`.
- Sap/Heartwood crops may use `SEMANTIC_FOREGROUND`.
- Copper semantic pixels must never be treated as physical support geometry.

Overlap is defined as any positive intersection of non-background support pixels after
reprojection into source-image pixel space. Boundary-touching without shared pixels is
not overlap. If overlap is detected, exclude the affected full-image instance item and
record a warning with the source image id and affected crop/artifact ids. Valid crop
classification and crop semantic items remain exportable.

### Crop-Level Classification

`classificationItems[]` are crop-based classification samples with source-image
provenance. They are not labels for whole original images.

Each item references an approved crop classification and includes:

```text
sourceImageId
derivedCropId/cropId
cropImage.objectRefId
sourceImage.objectRefId
sliceInstanceId
sourceRect
transformToSource
classificationVersionId
classLabel
sapenCnnLabel
groupKey
split
warnings[]
```

Current `sapen-cnn` classification can consume CSV rows with either crop paths or
source-image plus bbox columns. The Annotate-side materializer should write crop images
and CSV rows that reference those materialized crop image paths.

Label mapping:

```text
COPPER_SLICE -> COPPER
SAP_HEARTWOOD_SLICE -> HEARTWOOD_STAINED
UNKNOWN -> skipped
REVIEW_REQUIRED -> skipped
```

### Crop Semantic Segmentation

`cropSemanticItems[]` are crop-image semantic segmentation samples in `CROP_PIXEL`.

Tasks:

```text
SAP_HEARTWOOD_SEMSEG
COPPER_SEMSEG
```

Required fields include:

```text
task
sourceImageId
derivedCropId/cropId
cropImage.objectRefId
semanticMask.objectRefId
semanticMask.artifactVersionId
semanticMask.format = u8raw-v1
semanticMask.coordinateSpace = CROP_PIXEL
semanticMask.cropSemanticMode
semanticMask.labelMappingForSapenCnn
supportGeometry.source
supportMask.artifactVersionId optional/required by task
classificationVersionId
classification.class
groupKey
split
warnings[]
```

Sap/Heartwood items require `cropSemanticMode = SAP_HEARTWOOD` and
`classification.class = SAP_HEARTWOOD_SLICE`. Raw labels map:

```text
0 -> 0 background
1 -> 1 sapwood
2 -> 2 heartwood
```

Copper items require `cropSemanticMode = COPPER`, `classification.class = COPPER_SLICE`,
and explicit approved crop support. Raw labels map:

```text
0 -> 0 background
3 -> 1 copper
```

Invalid family labels must be skipped or failed with an explicit warning; they must not
be silently remapped.

## Current SaPen-CNN Local Layout

The local materializer writes datasets compatible with the current read-only loaders.

Instance segmentation:

```text
instseg/train/images/<sourceImageId>.<ext>
instseg/train/masks/<sourceImageId>.tif
instseg/val/images/<sourceImageId>.<ext>
instseg/val/masks/<sourceImageId>.tif
```

Classification:

```text
classification/train/images/<cropId>.png
classification/val/images/<cropId>.png
classification/train_manifest.csv
classification/val_manifest.csv
```

CSV columns:

```text
sample_id,image_path,label,source_image_id,crop_id,bbox_x,bbox_y,bbox_w,bbox_h,group_key,split
```

Semantic segmentation:

```text
semseg/sap_heartwood/train/images/<cropId>.png
semseg/sap_heartwood/train/masks/<cropId>.png
semseg/sap_heartwood/val/images/<cropId>.png
semseg/sap_heartwood/val/masks/<cropId>.png

semseg/copper/train/images/<cropId>.png
semseg/copper/train/masks/<cropId>.png
semseg/copper/val/images/<cropId>.png
semseg/copper/val/masks/<cropId>.png
```

## Instance Mask Encoding

Current `../sapen-cnn/models/sapen_instseg/data/dataset.py` normalizes common Pillow
integer image modes before converting masks to `long`. That makes 8-bit PNG unsafe for
real instance ids.

The desired contract for materialized instance masks is 32-bit integer TIFF mode `I`.
Do not downgrade to PNG instance masks. If the current CNN environment cannot train on
that format, the materializer must record that explicitly in `materialization_report.json`
and the CNN-side follow-up ticket must fix or pin loader support.

## Non-Goals

- Editing `../sapen-cnn` during this sprint.
- Running training.
- Treating source images as one class per image.
- Exposing storage keys in normal browser/API responses.
- Replacing existing ZIP export behavior for existing targets.
