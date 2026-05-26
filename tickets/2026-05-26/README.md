# SaPen Annotate → SaPen-CNN Training Handoff Tickets

These tickets assume the current work happens in `sapen-annotate`.

Important boundary:

```text
../sapen-cnn is read-only for Codex during this sprint.
```

Ticket sequence:

1. `done/EX-001-sapen-cnn-training-dataset-contract.md`  
   Define the architecture/data contract.

2. `EX-002-manifest-only-training-snapshot-mode.md`  
   Add manifest-only snapshot transport without making ZIP the primary training path.

3. `EX-003-full-image-training-from-crop-annotations.md`  
   Build full-image instance/classification manifest data derived from crop annotations.

4. `EX-004-crop-semantic-training-dataset-snapshot.md`  
   Build crop semantic segmentation manifest data for Sap/Heartwood and Copper models.

5. `EX-005-annotate-side-local-sapen-cnn-materializer.md`  
   Add an annotate-side local materializer that creates `sapen-cnn`-compatible local folders/manifests without editing `sapen-cnn`.
