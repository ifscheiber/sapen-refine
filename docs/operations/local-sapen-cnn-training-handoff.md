# Local SaPen-CNN Training Handoff

## Purpose

This page documents the operator workflow for materializing SaPen Annotate CNN
training snapshots into local `sapen-cnn` dataset folders.

The authoritative data contract is
[`../06-data/sapen-cnn-training-dataset-snapshot-contract.md`](../06-data/sapen-cnn-training-dataset-snapshot-contract.md).

## Current Implementation

The Annotate-side materializer lives at:

```text
scripts/materialize-sapen-cnn-dataset.mjs
```

Package command:

```bash
npm run dataset:materialize -- --help
```

It reads a completed `sapen-annotate-cnn-training-dataset-v1` public manifest plus
private materialization refs and writes local `sapen-cnn`-compatible folders. It does
not run training and must not modify tracked files in `../sapen-cnn`.

## Inputs

Offline/test input:

```bash
npm run dataset:materialize -- \
  --manifest ./manifest.json \
  --materialization-refs ./materialization-refs.json \
  --output-dir ../sapen-cnn/datasets/sapen/<snapshot-id>
```

Operator input from a completed export:

```bash
SAPEN_DATASET_EMAIL='<named-project-owner>' \
SAPEN_DATASET_PASSWORD_FILE=/run/secrets/sapen-dataset-password \
npm run dataset:materialize -- \
  --export-id <export-batch-id> \
  --base-url http://localhost:3000 \
  --output-dir ../sapen-cnn/datasets/sapen/<snapshot-id>
```

Use the currently documented operator secret mechanism; do not record secrets in shell
history, docs, manifests, reports, or tickets. The CLI supports `--password-file`,
`SAPEN_DATASET_PASSWORD_FILE`, `SAPEN_DATASET_PASSWORD`, and `--password-stdin`.
The legacy `--password` argument is accepted only as a deprecated compatibility path.

Direct object-store downloads require:

```text
S3_ENDPOINT
S3_BUCKET
S3_ACCESS_KEY
S3_SECRET_KEY
S3_REGION optional
S3_FORCE_PATH_STYLE optional
```

Private refs can also use `presignedUrl`. Unit fixtures may use `localPath`.

## Output Layout

Stable metadata files:

```text
<output-dir>/
  source_manifest.json
  materialization_report.json
  checksums.json
  label_mappings.json
  README.md
  .cache/objects/
```

Instance segmentation:

```text
instseg/train/images/<sourceImageId>.<ext>
instseg/train/masks/<sourceImageId>.tif
instseg/val/images/<sourceImageId>.<ext>
instseg/val/masks/<sourceImageId>.tif
```

Instance masks are dense 32-bit integer TIFF files:

```text
0 = background
1..N = manifest-order slice instances
```

Do not downgrade instance masks to PNG. If the active `sapen-cnn` environment cannot
consume TIFF mode `I`, treat that as the CNN-side follow-up covered by SCNN-001.

Classification:

```text
classification/train/images/<cropId>.png
classification/val/images/<cropId>.png
classification/train_manifest.csv
classification/val_manifest.csv
```

CSV rows include both `crop_path` and `image_path` pointing at the materialized crop
image, plus source-image provenance and bbox fields.

Crop semantic segmentation:

```text
semseg/sap_heartwood/<split>/images/<cropId>.png
semseg/sap_heartwood/<split>/masks/<cropId>.png
semseg/copper/<split>/images/<cropId>.png
semseg/copper/<split>/masks/<cropId>.png
```

Raw `.u8raw-v1` masks are decoded with manifest dimensions and remapped per task:

```text
SAP_HEARTWOOD_SEMSEG: 0 -> 0, 1 -> 1, 2 -> 2
COPPER_SEMSEG:        0 -> 0, 3 -> 1
```

Invalid semantic labels, checksum mismatch, dimension mismatch, missing object refs,
unsupported manifest versions, unsafe overwrite, and instance overlap fail loudly.

## Invariants

- Do not record object-storage secrets in docs, manifests, reports, or shell history.
- Do not modify tracked files in `../sapen-cnn` from the Annotate materializer.
- Public manifests must not expose storage keys, buckets, or signed URLs.
- Private object refs are available only through the audited materialization-refs path
  for authorized project owners.
- Ordinary export summaries and public manifests must not include storage keys.

## Validation

Focused materializer coverage lives in:

```text
tests/unit/sapen-cnn-materializer.test.ts
```

Run:

```bash
npm run test -- tests/unit/sapen-cnn-materializer.test.ts
```
