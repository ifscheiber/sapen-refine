"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type ExportTarget =
  | "semantic_segmentation"
  | "support_segmentation"
  | "slice_classification"
  | "combined"
  | "crop_training";
type PredictionTarget = "SEMANTIC_MASK" | "SLICE_SUPPORT_MASK" | "SLICE_CLASSIFICATION";

type ExportReadiness = {
  project: { id: string; name: string };
  myRole: string;
  canExport: boolean;
  summary: {
    totalImages: number;
    approvedSemanticMasks: number;
    approvedSupportMasks: number;
    approvedClassifications: number;
    imagesWithWarnings: number;
    totalCropItems: number;
    readyCropItems: number;
    partialCropItems: number;
    notReadyCropItems: number;
    reviewRequiredCropItems: number;
    cropItemsWithWarnings: number;
    cropReasonCounts?: Record<string, number>;
  };
};

type CreatedExport = {
  id: string;
  status: string;
  target: string;
  itemCount: number;
  warningCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  qaMetricsSummary?: {
    computedItemCount: number;
    notComputedItemCount: number;
    notComputedReasons?: Record<string, number>;
  } | null;
  manifestChecksum: string | null;
  packageChecksum: string | null;
  packageMode?: "zip" | "manifest_only";
  manifestAvailable?: boolean;
  packageAvailable?: boolean;
  downloads: {
    manifest: string;
    package: string | null;
  } | null;
};

type PredictionRunSummary = {
  id: string;
  inferenceRunId: string | null;
  status: string;
  generatedAt: string;
  modelRun: {
    id: string;
    modelFamily: string;
    modelName: string;
    modelVersion: string | null;
    taskType: string;
  };
  _count: { predictions: number; tasks: number };
};

type PredictionAnalysisReadiness = {
  project: { id: string; name: string };
  myRole: string;
  canExport: boolean;
  predictionRuns: PredictionRunSummary[];
  summary: {
    totalCandidates: number;
    semanticPredictions: number;
    supportPredictions: number;
    classificationPredictions: number;
    candidatesWithCorrectionTasks: number;
    candidatesWithHumanReferences: number;
    metricEligibleCandidates: number;
    candidatesWithoutApprovedReference: number;
    classificationMetricsDeferred: number;
    candidatesWithWarnings: number;
  };
};

type ProjectExportPanelProps = {
  projectId: string;
};

const TARGET_OPTIONS: Array<{ value: ExportTarget; label: string }> = [
  { value: "semantic_segmentation", label: "Semantic segmentation" },
  { value: "support_segmentation", label: "Support segmentation" },
  { value: "slice_classification", label: "Slice classification" },
  { value: "combined", label: "Combined manifest" },
  { value: "crop_training", label: "Crop training" },
];

const PREDICTION_TARGET_OPTIONS: Array<{ value: PredictionTarget; label: string }> = [
  { value: "SEMANTIC_MASK", label: "Semantic predictions" },
  { value: "SLICE_SUPPORT_MASK", label: "Support predictions" },
  { value: "SLICE_CLASSIFICATION", label: "Classification proposals" },
];

function errorMessage(error: unknown, fallback = "EXPORT_FAILED") {
  return error instanceof Error ? error.message : fallback;
}

function isActiveExportStatus(status: string) {
  return status === "PENDING" || status === "PROCESSING" || status === "CREATED";
}

export function ProjectExportPanel({ projectId }: ProjectExportPanelProps) {
  const [readiness, setReadiness] = useState<ExportReadiness | null>(null);
  const [predictionReadiness, setPredictionReadiness] = useState<PredictionAnalysisReadiness | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<ExportTarget[]>([
    "semantic_segmentation",
    "support_segmentation",
    "slice_classification",
  ]);
  const [selectedPredictionTargets, setSelectedPredictionTargets] = useState<PredictionTarget[]>([
    "SEMANTIC_MASK",
    "SLICE_SUPPORT_MASK",
    "SLICE_CLASSIFICATION",
  ]);
  const [selectedPredictionRunId, setSelectedPredictionRunId] = useState("");
  const [includeHumanReferences, setIncludeHumanReferences] = useState(true);
  const [createdExport, setCreatedExport] = useState<CreatedExport | null>(null);
  const [createdPredictionExport, setCreatedPredictionExport] = useState<CreatedExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [predictionLoading, setPredictionLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingPredictionExport, setCreatingPredictionExport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  const targetSummary = useMemo(() => {
    if (selectedTargets.includes("crop_training")) return ["crop_training"];
    if (selectedTargets.includes("combined")) return ["combined"];
    return selectedTargets;
  }, [selectedTargets]);

  const loadReadiness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/export/readiness`, {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `READINESS_FAILED_${res.status}`);
      setReadiness(data as ExportReadiness);
    } catch (e: unknown) {
      setError(errorMessage(e, "EXPORT_READINESS_FAILED"));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  const loadPredictionReadiness = useCallback(async () => {
    setPredictionLoading(true);
    setPredictionError(null);
    try {
      if (selectedPredictionTargets.length === 0) {
        setPredictionReadiness(null);
        return;
      }
      const params = new URLSearchParams();
      if (selectedPredictionRunId) params.set("predictionRunId", selectedPredictionRunId);
      params.set("includeHumanReferences", String(includeHumanReferences));
      selectedPredictionTargets.forEach((target) => params.append("targetType", target));
      const res = await fetch(
        `/api/projects/${projectId}/prediction-analysis-export/readiness?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `PREDICTION_ANALYSIS_READINESS_FAILED_${res.status}`);
      }
      setPredictionReadiness(data as PredictionAnalysisReadiness);
    } catch (e: unknown) {
      setPredictionError(errorMessage(e, "PREDICTION_ANALYSIS_READINESS_FAILED"));
    } finally {
      setPredictionLoading(false);
    }
  }, [includeHumanReferences, projectId, selectedPredictionRunId, selectedPredictionTargets]);

  useEffect(() => {
    void loadPredictionReadiness();
  }, [loadPredictionReadiness]);

  useEffect(() => {
    if (!createdExport || !isActiveExportStatus(createdExport.status)) return undefined;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/exports/${createdExport.id}`, { method: "GET", cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.ok) setCreatedExport(data.export as CreatedExport);
      } catch {
        // Polling errors are surfaced by the next manual refresh or final failed status.
      }
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [createdExport]);

  useEffect(() => {
    if (!createdPredictionExport || !isActiveExportStatus(createdPredictionExport.status)) return undefined;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/prediction-analysis-exports/${createdPredictionExport.id}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.ok) setCreatedPredictionExport(data.export as CreatedExport);
      } catch {
        // Polling errors are surfaced by the next manual refresh or final failed status.
      }
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [createdPredictionExport]);

  function toggleTarget(target: ExportTarget) {
    setSelectedTargets((current) => {
      if (target === "crop_training") {
        return current.includes("crop_training") ? [] : ["crop_training"];
      }
      if (target === "combined") return current.includes("combined") ? [] : ["combined"];
      const withoutCombined = current.filter((item) => item !== "combined" && item !== "crop_training");
      if (withoutCombined.includes(target)) {
        return withoutCombined.filter((item) => item !== target);
      }
      return [...withoutCombined, target];
    });
  }

  function togglePredictionTarget(target: PredictionTarget) {
    setSelectedPredictionTargets((current) => {
      if (current.includes(target)) return current.filter((item) => item !== target);
      return [...current, target];
    });
  }

  async function createExport() {
    setCreating(true);
    setError(null);
    setCreatedExport(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/exports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targets: targetSummary }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `EXPORT_FAILED_${res.status}`);
      setCreatedExport(data.export as CreatedExport);
      await loadReadiness();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  async function createPredictionAnalysisExport() {
    setCreatingPredictionExport(true);
    setPredictionError(null);
    setCreatedPredictionExport(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/prediction-analysis-exports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          predictionRunId: selectedPredictionRunId || null,
          targetTypes: selectedPredictionTargets,
          includeHumanReferences,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `PREDICTION_ANALYSIS_EXPORT_FAILED_${res.status}`);
      }
      setCreatedPredictionExport(data.export as CreatedExport);
      await loadPredictionReadiness();
    } catch (e: unknown) {
      setPredictionError(errorMessage(e, "PREDICTION_ANALYSIS_EXPORT_FAILED"));
    } finally {
      setCreatingPredictionExport(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Training export</h2>
          <div className="mt-1 text-sm text-muted-foreground">
            Role: {readiness?.myRole ?? "Loading"}
          </div>
        </div>
        <Button variant="outline" onClick={() => void loadReadiness()} disabled={loading || creating}>
          Refresh
        </Button>
      </div>

      {readiness && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-xs text-muted-foreground">Images</div>
            <div className="text-lg font-semibold">{readiness.summary.totalImages}</div>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-xs text-muted-foreground">Semantic approved</div>
            <div className="text-lg font-semibold">{readiness.summary.approvedSemanticMasks}</div>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-xs text-muted-foreground">Support approved</div>
            <div className="text-lg font-semibold">{readiness.summary.approvedSupportMasks}</div>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-xs text-muted-foreground">Classifications approved</div>
            <div className="text-lg font-semibold">{readiness.summary.approvedClassifications}</div>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-xs text-muted-foreground">Crop ready</div>
            <div className="text-lg font-semibold">
              {readiness.summary.readyCropItems}/{readiness.summary.totalCropItems}
            </div>
            <div className="text-xs text-muted-foreground">
              {readiness.summary.partialCropItems} partial · {readiness.summary.reviewRequiredCropItems} review ·{" "}
              {readiness.summary.notReadyCropItems} not ready
            </div>
            <div className="text-xs text-muted-foreground">
              {Object.entries(readiness.summary.cropReasonCounts ?? {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([reason, count]) => `${reason}: ${count}`)
                .join(" · ") || "No crop warnings"}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TARGET_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selectedTargets.includes(option.value)}
              onChange={() => toggleTarget(option.value)}
              disabled={creating}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void createExport()}
          disabled={!readiness?.canExport || creating || targetSummary.length === 0}
        >
          {creating ? "Creating export..." : "Create export"}
        </Button>
        {readiness && !readiness.canExport && (
          <div className="text-sm text-muted-foreground">Export requires project owner access.</div>
        )}
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>

      {createdExport && (
        <div className="rounded-md border border-border bg-background p-3 text-sm">
          <div className="font-medium">Export {createdExport.status}</div>
          <div className="mt-1 text-muted-foreground">
            {createdExport.id} · {createdExport.itemCount} item rows · {createdExport.warningCount} warnings
          </div>
          {createdExport.packageMode && (
            <div className="mt-1 text-muted-foreground">
              Mode: {createdExport.packageMode === "manifest_only" ? "Manifest-only snapshot" : "ZIP package"}
            </div>
          )}
          {createdExport.errorCode && (
            <div className="mt-2 text-destructive">{createdExport.errorMessage ?? createdExport.errorCode}</div>
          )}
          {createdExport.downloads && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={createdExport.downloads.manifest}>Download manifest</a>
              </Button>
              {createdExport.downloads.package && (
                <Button asChild variant="outline">
                  <a href={createdExport.downloads.package}>Download package</a>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 border-t border-border pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Prediction analysis export</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              Model proposals for QA only, not ground-truth training labels.
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => void loadPredictionReadiness()}
            disabled={predictionLoading || creatingPredictionExport}
          >
            Refresh
          </Button>
        </div>

        {predictionReadiness && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">Candidates</div>
              <div className="text-lg font-semibold">{predictionReadiness.summary.totalCandidates}</div>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">Semantic proposals</div>
              <div className="text-lg font-semibold">{predictionReadiness.summary.semanticPredictions}</div>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">Support proposals</div>
              <div className="text-lg font-semibold">{predictionReadiness.summary.supportPredictions}</div>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">Classification</div>
              <div className="text-lg font-semibold">{predictionReadiness.summary.classificationPredictions}</div>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">Metric-ready</div>
              <div className="text-lg font-semibold">
                {predictionReadiness.summary.metricEligibleCandidates}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">No approved ref</div>
              <div className="text-lg font-semibold">
                {predictionReadiness.summary.candidatesWithoutApprovedReference}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Prediction run</span>
            <select
              className="min-h-11 rounded-md border border-border bg-background px-3 py-2"
              value={selectedPredictionRunId}
              onChange={(event) => setSelectedPredictionRunId(event.target.value)}
              disabled={predictionLoading || creatingPredictionExport}
            >
              <option value="">All prediction runs</option>
              {predictionReadiness?.predictionRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.inferenceRunId ?? run.id} · {run.modelRun.modelName}
                  {run.modelRun.modelVersion ? ` ${run.modelRun.modelVersion}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 self-end rounded-md border border-border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={includeHumanReferences}
              onChange={(event) => setIncludeHumanReferences(event.target.checked)}
              disabled={creatingPredictionExport}
            />
            <span>Include human references</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {PREDICTION_TARGET_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selectedPredictionTargets.includes(option.value)}
                onChange={() => togglePredictionTarget(option.value)}
                disabled={creatingPredictionExport}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
          Prediction analysis exports contain model proposals and are not ground-truth training labels.
          QA metrics compare predictions only against approved human references where available.
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => void createPredictionAnalysisExport()}
            disabled={
              !predictionReadiness?.canExport ||
              creatingPredictionExport ||
              selectedPredictionTargets.length === 0 ||
              (predictionReadiness?.summary.totalCandidates ?? 0) === 0
            }
          >
            {creatingPredictionExport ? "Creating prediction export..." : "Create prediction analysis export"}
          </Button>
          {predictionReadiness && !predictionReadiness.canExport && (
            <div className="text-sm text-muted-foreground">Prediction analysis export requires owner or QA access.</div>
          )}
          {predictionError && <div className="text-sm text-destructive">{predictionError}</div>}
        </div>

        {createdPredictionExport && (
          <div className="rounded-md border border-border bg-background p-3 text-sm">
            <div className="font-medium">Prediction analysis export {createdPredictionExport.status}</div>
            <div className="mt-1 text-muted-foreground">
              {createdPredictionExport.id} · {createdPredictionExport.itemCount} item rows ·{" "}
              {createdPredictionExport.warningCount} warnings
            </div>
            {createdPredictionExport.qaMetricsSummary && (
              <div className="mt-1 text-muted-foreground">
                QA metrics: {createdPredictionExport.qaMetricsSummary.computedItemCount} computed ·{" "}
                {createdPredictionExport.qaMetricsSummary.notComputedItemCount} not computed
              </div>
            )}
            {createdPredictionExport.errorCode && (
              <div className="mt-2 text-destructive">
                {createdPredictionExport.errorMessage ?? createdPredictionExport.errorCode}
              </div>
            )}
            {createdPredictionExport.downloads && (
              <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={createdPredictionExport.downloads.manifest}>Download manifest</a>
              </Button>
              {createdPredictionExport.downloads.package && (
                <Button asChild variant="outline">
                  <a href={createdPredictionExport.downloads.package}>Download package</a>
                </Button>
              )}
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
