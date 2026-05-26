# EX-005 — Annotate-Side Local SaPen-CNN Dataset Materializer

## Status

Planned

## Priority

P1

## Type

CLI / Data Materialization / Object Storage / Training Handoff / Local Workflow

## Repository

`sapen-annotate`

## Read-only dependency

`../sapen-cnn` may be used as a read-only compatibility reference. The materializer may write to a user-provided output directory, but this ticket must not modify tracked files in `../sapen-cnn`.

## Depends on

- EX-001 — SaPen-CNN Training Dataset Snapshot Contract
- EX-002 — Manifest-Only Training Dataset Snapshot Mode
- EX-003 — Full-Image Training Dataset Derived From Crop Annotations
- EX-004 — Crop Semantic Training Dataset Snapshot

---

## 1. Context

Training happens locally, while source images/crops/masks live in IONOS/S3-compatible object storage.

Since this sprint works in `sapen-annotate` and `../sapen-cnn` is read-only, the local dataset materialization tool should live in `sapen-annotate`, not in `sapen-cnn`.

The materializer should read a SaPen-CNN training snapshot manifest and produce local filesystem datasets that the current `sapen-cnn` loaders/configs can consume.

This is not a background service and not a training runner. It is an operator/local CLI tool.

---

## 2. Goal

Add an annotate-side local materializer script/CLI that:

1. Reads a completed manifest-only training snapshot.
2. Resolves object refs through existing operator/service access or presigned URLs.
3. Downloads/caches source images, crops and raw masks directly from object storage.
4. Verifies checksums and dimensions.
5. Converts `.u8raw-v1` masks to `sapen-cnn`-compatible local mask files.
6. Reprojects crop support geometry to full source-image instance masks.
7. Writes local `sapen-cnn`-compatible dataset folders and manifests.
8. Writes provenance files so a training run can be traced back to the exact `ExportBatch`/snapshot.

Suggested script location:

```text
scripts/materialize-sapen-cnn-dataset.mjs
```

or, if Python is more practical for image/mask conversion:

```text
scripts/materialize_sapen_cnn_dataset.py
```

If Python is used, document required local dependencies and avoid adding heavy runtime dependencies to the Next.js app unless justified.

---

## 3. CLI contract

Suggested command:

```bash
npm run dataset:materialize -- \
  --manifest ./manifest.json \
  --output-dir ../sapen-cnn/datasets/sapen/<snapshot-id> \
  --s3-endpoint "$S3_ENDPOINT" \
  --s3-bucket "$S3_BUCKET" \
  --s3-access-key "$S3_ACCESS_KEY" \
  --s3-secret-key "$S3_SECRET_KEY"
```

Alternative accepted inputs:

```bash
npm run dataset:materialize -- --export-id <id> --output-dir <path>
```

if the script can call the app/operator endpoint to retrieve the materialization manifest.

Required options:

```text
--manifest or --export-id
--output-dir
--overwrite false by default
--verify-checksums true by default
--split-policy use manifest assignments by default
```

The script must fail loudly on:

- missing object refs,
- checksum mismatch,
- dimension mismatch,
- unsupported mask format,
- invalid label values,
- unsafe overwrite unless `--overwrite` is passed.

---

## 4. Local output layout

The materializer must write a stable output root:

```text
<output-dir>/
  source_manifest.json
  materialization_report.json
  checksums.json
  label_mappings.json
  README.md
```

### 4.1 Instance segmentation output

For full-image instance segmentation:

```text
<output-dir>/instseg/train/images/<sourceImageId>.<ext>
<output-dir>/instseg/train/masks/<sourceImageId>.<mask-ext>
<output-dir>/instseg/val/images/<sourceImageId>.<ext>
<output-dir>/instseg/val/masks/<sourceImageId>.<mask-ext>
```

The mask must be a dense instance-id image:

```text
0 = background
1..N = slice instances in deterministic manifest order
```

Mask encoding must be compatible with the current `../sapen-cnn/models/sapen_instseg/data/dataset.py` loader without modifying `sapen-cnn`.

Important:

- Verify whether 8-bit `L` PNG collapses ids due to normalization in current `sapen-cnn`.
- If so, use an integer-preserving format verified against the current loader, e.g. TIFF mode `I`.
- Add a local test fixture proving that the chosen output format round-trips through the current read-only loader contract if feasible, or document a manual verification command.

### 4.2 Classification output

For classification:

```text
<output-dir>/classification/train_manifest.csv
<output-dir>/classification/val_manifest.csv
<output-dir>/classification/test_manifest.csv optional
```

CSV columns should support the current `sapen-cnn` classifier dataset:

```text
source_image_path,bbox_x0,bbox_y0,bbox_x1,bbox_y1,label
```

Optional additional columns are allowed and useful:

```text
project_id,source_image_id,crop_id,slice_instance_id,classification_version_id,split,checksum
```

Required label mapping:

```text
COPPER_SLICE        -> COPPER
SAP_HEARTWOOD_SLICE -> HEARTWOOD_STAINED
```

Exclude by default:

```text
UNKNOWN
REVIEW_REQUIRED
```

### 4.3 Semantic segmentation output

For crop semantic segmentation:

```text
<output-dir>/semseg/sap_heartwood/train/images/<cropId>.png
<output-dir>/semseg/sap_heartwood/train/masks/<cropId>.png
<output-dir>/semseg/sap_heartwood/val/images/<cropId>.png
<output-dir>/semseg/sap_heartwood/val/masks/<cropId>.png

<output-dir>/semseg/copper/train/images/<cropId>.png
<output-dir>/semseg/copper/train/masks/<cropId>.png
<output-dir>/semseg/copper/val/images/<cropId>.png
<output-dir>/semseg/copper/val/masks/<cropId>.png
```

Mask remapping:

Sap/Heartwood:

```text
raw 0 -> 0
raw 1 -> 1 sapwood
raw 2 -> 2 heartwood
```

Copper:

```text
raw 0 -> 0
raw 3 -> 1 copper
```

Fail or skip with warning if invalid labels for the task are encountered.

---

## 5. Object download and caching

The materializer must not download through the app server unless explicitly using presigned URLs. Prefer direct object-storage download.

Supported access modes:

```text
1. storageKey + local S3 credentials
2. presigned URL from operator/service endpoint
```

Downloaded objects should be cached under:

```text
<output-dir>/.cache/objects/<sha256-or-safe-key>
```

or another deterministic cache directory.

Never write secrets into manifest/report files.

---

## 6. Reprojection rules for instance masks

Use integer translation crop transform only:

```text
sourceX = cropX + cropOriginX
sourceY = cropY + cropOriginY
```

Reject or skip items if:

- transform version is unsupported,
- crop dimensions do not match mask dimensions,
- projected coordinates leave source image bounds,
- two crop support geometries overlap and no explicit conflict policy is provided.

Default overlap policy:

```text
fail the affected source image materialization and record it in materialization_report.json
```

Do not silently overwrite instance ids.

---

## 7. Non-goals

Do not implement here:

- model training execution,
- permanent changes to `../sapen-cnn`,
- a web UI for dataset materialization,
- a general data lake sync tool,
- ZIP handoff replacement for external customers.

---

## 8. Acceptance criteria

- A materializer script/CLI exists in `sapen-annotate`.
- It can consume a sample snapshot manifest fixture.
- It writes instance-segmentation directories with matching image/mask stems.
- It writes classification CSV manifests compatible with current `sapen-cnn`.
- It writes crop semantic directories for Sap/Heartwood and Copper tasks with matching image/mask stems.
- It converts `.u8raw-v1` masks using manifest dimensions.
- It applies task-specific label remapping and rejects invalid labels.
- It verifies checksums/dimensions by default.
- It writes `source_manifest.json`, `materialization_report.json`, `checksums.json`, and `label_mappings.json`.
- It does not modify any tracked file in `../sapen-cnn`.
- Documentation explains how to run the materializer and then point `sapen-cnn` configs to the generated local folders/manifests.

---

## 9. Suggested files to inspect/edit

In `sapen-annotate`:

```text
scripts/materialize-sapen-cnn-dataset.mjs
scripts/materialize_sapen_cnn_dataset.py
package.json
docs/operations/local-sapen-cnn-training-handoff.md
docs/06-data/sapen-cnn-training-dataset-snapshot-contract.md
tests/unit or tests/integration materializer fixture tests
```

Read-only in `../sapen-cnn`:

```text
../sapen-cnn/models/sapen_instseg/data/dataset.py
../sapen-cnn/models/sapen_clsf/dataset.py
../sapen-cnn/models/sapen_semseg/data/dataset.py
../sapen-cnn/configs/instseg/dinov2_frozen.json
../sapen-cnn/configs/clsf/slice_stain_resnet18.json
../sapen-cnn/configs/semseg/heartwood_sapwood_instance_patches_dinov2_multiscale.json
../sapen-cnn/configs/semseg/copper_binary_instance_patches_dinov2.json
```

---

## 10. Validation

Run from `sapen-annotate`:

```bash
git status --short
npm run lint
npm run typecheck
npm run test
```

Add focused materializer tests with tiny fixtures:

```text
1 source image, 2 crops, 2 semantic masks, 2 classifications
```

Test cases:

- successful materialization,
- checksum mismatch fails,
- invalid semantic label fails/skips according to policy,
- overlap conflict fails affected source image,
- classification CSV label mapping,
- split grouping preserved.

If Python is used, add an explicit command for its tests, for example:

```bash
python -m pytest tests/materializer
```

only if the repo already supports Python tests or this is intentionally added.

---

## 11. Codex prompt

You are working in `sapen-annotate`. `../sapen-cnn` is read-only and must not be modified.

Implement an annotate-side local SaPen-CNN dataset materializer. It should read a completed SaPen-CNN training dataset snapshot manifest, resolve object refs via direct S3 credentials or presigned URLs, download/copy objects locally, verify checksums/dimensions, decode `.u8raw-v1` masks with manifest dimensions, reproject crop support geometry to full-image instance masks, write classification CSVs, write crop semantic train/val directories with task-specific label remapping, and produce provenance reports. The generated filesystem must be compatible with the current read-only `sapen-cnn` loaders/configs. Do not run training and do not edit `../sapen-cnn`.
