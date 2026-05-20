"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks, Play, RefreshCw, RotateCcw, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

type PredictionRunSummary = {
  id: string;
  status: string;
  inferenceRunId: string | null;
  generatedAt: string;
  modelRun: {
    modelFamily: string;
    modelName: string;
    modelVersion: string | null;
    taskType: string;
  };
  _count?: { predictions: number; tasks: number };
};

type BatchSummary = {
  id: string;
  predictionRunId: string;
  status: string;
  sourceFilename: string | null;
  totalItems: number;
  pendingItems: number;
  processingItems: number;
  succeededItems: number;
  failedItems: number;
  skippedItems: number;
  retryPendingItems: number;
  createdAt: string;
  completedAt: string | null;
  predictionRun: PredictionRunSummary;
  errorSummaryJson: { errorCounts?: Record<string, number> } | null;
};

type BatchItem = {
  id: string;
  clientItemId: string | null;
  imageId: string;
  targetType: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  sourcePath: string | null;
  expectedChecksum: string | null;
  expectedWidth: number;
  expectedHeight: number;
  predictionArtifactVersionId: string | null;
  predictionProvenanceId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  image: { filename: string | null; width: number | null; height: number | null };
};

function runLabel(run: PredictionRunSummary) {
  const model = [run.modelRun.modelFamily, run.modelRun.modelName, run.modelRun.modelVersion]
    .filter(Boolean)
    .join("/");
  const suffix = run.inferenceRunId ? ` - ${run.inferenceRunId}` : "";
  return `${model}${suffix}`;
}

function batchLabel(batch: BatchSummary) {
  return batch.sourceFilename || batch.id.slice(0, 8);
}

function formatDate(value: string | null) {
  if (!value) return "Open";
  return new Date(value).toLocaleString();
}

function statusTone(status: string) {
  if (status === "COMPLETED" || status === "SUCCEEDED") return "border-success text-success";
  if (status === "FAILED" || status === "COMPLETED_WITH_ERRORS") return "border-destructive text-destructive";
  return "border-border text-muted-foreground";
}

export function ProjectPredictionImportBatchPanel({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const [predictionRuns, setPredictionRuns] = useState<PredictionRunSummary[]>([]);
  const [selectedPredictionRunId, setSelectedPredictionRunId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [itemsByBatch, setItemsByBatch] = useState<Record<string, BatchItem[]>>({});
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [processLimit, setProcessLimit] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedRun = useMemo(
    () => predictionRuns.find((run) => run.id === selectedPredictionRunId) ?? null,
    [predictionRuns, selectedPredictionRunId],
  );

  const loadPredictionRuns = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/prediction-runs`, {
      credentials: "include",
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "PREDICTION_RUNS_LOAD_FAILED");
    const runs = data.predictionRuns as PredictionRunSummary[];
    setPredictionRuns(runs);
    setSelectedPredictionRunId((current) => current || runs[0]?.id || "");
  }, [projectId]);

  const loadBatches = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/prediction-import-batches?limit=20`, {
      credentials: "include",
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "BATCHES_LOAD_FAILED");
    setBatches(data.batches as BatchSummary[]);
  }, [projectId]);

  const loadItems = useCallback(async (batchId: string) => {
    const response = await fetch(`/api/prediction-import-batches/${batchId}/items`, {
      credentials: "include",
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "BATCH_ITEMS_LOAD_FAILED");
    setItemsByBatch((current) => ({ ...current, [batchId]: data.items as BatchItem[] }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError(null);
        await Promise.all([loadPredictionRuns(), loadBatches()]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "BATCH_IMPORTS_LOAD_FAILED");
      }
    }
    if (canManage) void load();
    return () => {
      cancelled = true;
    };
  }, [canManage, loadBatches, loadPredictionRuns]);

  async function createBatch() {
    if (!selectedPredictionRunId || !selectedFile) return;
    setBusy("create");
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("file", selectedFile);
      const response = await fetch(`/api/prediction-runs/${selectedPredictionRunId}/batch-imports`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "BATCH_CREATE_FAILED");
      setSelectedFile(null);
      setMessage(`Batch ${batchLabel(data.batch)} created with ${data.batch.totalItems} items.`);
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "BATCH_CREATE_FAILED");
    } finally {
      setBusy(null);
    }
  }

  async function processBatch(batchId: string) {
    setBusy(`process:${batchId}`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/prediction-import-batches/${batchId}/process`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: processLimit }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "BATCH_PROCESS_FAILED");
      setMessage(`Processed ${data.processedCount} items.`);
      await Promise.all([loadBatches(), loadItems(batchId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "BATCH_PROCESS_FAILED");
    } finally {
      setBusy(null);
    }
  }

  async function retryBatch(batchId: string) {
    setBusy(`retry:${batchId}`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/prediction-import-batches/${batchId}/retry`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "BATCH_RETRY_FAILED");
      setMessage(`Reset ${data.resetCount} failed items.`);
      await Promise.all([loadBatches(), loadItems(batchId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "BATCH_RETRY_FAILED");
    } finally {
      setBusy(null);
    }
  }

  async function toggleItems(batchId: string) {
    const next = expandedBatchId === batchId ? null : batchId;
    setExpandedBatchId(next);
    if (next && !itemsByBatch[next]) {
      try {
        await loadItems(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "BATCH_ITEMS_LOAD_FAILED");
      }
    }
  }

  if (!canManage) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Prediction batch imports</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Import ZIP batches into existing prediction runs as proposal artifacts.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void Promise.all([loadPredictionRuns(), loadBatches()])}
          disabled={busy !== null}
        >
          <RefreshCw />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Prediction run</span>
          <select
            className="min-h-10 rounded-md border border-input bg-background px-3 py-2"
            value={selectedPredictionRunId}
            onChange={(event) => setSelectedPredictionRunId(event.target.value)}
            disabled={busy !== null || predictionRuns.length === 0}
          >
            {predictionRuns.length === 0 ? (
              <option value="">No prediction runs</option>
            ) : (
              predictionRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {runLabel(run)}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Process limit</span>
          <input
            className="min-h-10 rounded-md border border-input bg-background px-3 py-2"
            type="number"
            min={1}
            max={100}
            value={processLimit}
            onChange={(event) => setProcessLimit(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
          <Upload />
          <input
            className="min-w-0 flex-1 text-sm"
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            disabled={busy !== null || !selectedRun}
          />
        </label>
        <Button
          type="button"
          onClick={() => void createBatch()}
          disabled={busy !== null || !selectedRun || !selectedFile}
        >
          <Upload />
          Create batch
        </Button>
      </div>

      {message && <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">{message}</div>}
      {error && <div className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">{error}</div>}

      <div className="space-y-3">
        {batches.length === 0 ? (
          <div className="flex min-h-20 items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
            No batch imports yet.
          </div>
        ) : (
          batches.map((batch) => {
            const items = itemsByBatch[batch.id] ?? [];
            const hasFailures = batch.failedItems > 0 || batch.retryPendingItems > 0;
            return (
              <div key={batch.id} className="rounded-md border border-border bg-background p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{batchLabel(batch)}</span>
                      <span className={`rounded-md border px-2 py-1 text-xs ${statusTone(batch.status)}`}>
                        {batch.status}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {runLabel(batch.predictionRun)} · Created {formatDate(batch.createdAt)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-md border border-border px-2 py-1">Total {batch.totalItems}</span>
                      <span className="rounded-md border border-border px-2 py-1">Pending {batch.pendingItems}</span>
                      <span className="rounded-md border border-border px-2 py-1">Succeeded {batch.succeededItems}</span>
                      <span className="rounded-md border border-border px-2 py-1">Failed {batch.failedItems}</span>
                      <span className="rounded-md border border-border px-2 py-1">Retry {batch.retryPendingItems}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void toggleItems(batch.id)}
                      disabled={busy !== null}
                    >
                      <ListChecks />
                      Items
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void processBatch(batch.id)}
                      disabled={busy !== null || batch.pendingItems + batch.retryPendingItems === 0}
                    >
                      <Play />
                      Process
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void retryBatch(batch.id)}
                      disabled={busy !== null || !hasFailures}
                    >
                      <RotateCcw />
                      Retry
                    </Button>
                  </div>
                </div>

                {expandedBatchId === batch.id && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    {items.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No items loaded.</div>
                    ) : (
                      items.map((item) => (
                        <div
                          key={item.id}
                          className="grid gap-2 rounded-md border border-border p-3 text-sm lg:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{item.image.filename || item.imageId}</span>
                              <span className={`rounded-md border px-2 py-1 text-xs ${statusTone(item.status)}`}>
                                {item.status}
                              </span>
                              <span className="rounded-md border border-border px-2 py-1 text-xs">
                                {item.targetType}
                              </span>
                            </div>
                            <div className="mt-1 break-all text-xs text-muted-foreground">
                              {item.sourcePath} · {item.expectedWidth}x{item.expectedHeight} · attempt{" "}
                              {item.attemptCount}/{item.maxAttempts}
                            </div>
                          </div>
                          <div className="text-sm text-destructive">
                            {item.errorCode || item.predictionProvenanceId || "Pending"}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
