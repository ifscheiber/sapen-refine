"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type ExportTarget = "semantic_segmentation" | "support_segmentation" | "slice_classification" | "combined";

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
  };
};

type CreatedExport = {
  id: string;
  status: string;
  target: string;
  itemCount: number;
  warningCount: number;
  manifestChecksum: string | null;
  packageChecksum: string | null;
  downloads: {
    manifest: string;
    package: string;
  } | null;
};

type ProjectExportPanelProps = {
  projectId: string;
};

const TARGET_OPTIONS: Array<{ value: ExportTarget; label: string }> = [
  { value: "semantic_segmentation", label: "Semantic segmentation" },
  { value: "support_segmentation", label: "Support segmentation" },
  { value: "slice_classification", label: "Slice classification" },
  { value: "combined", label: "Combined manifest" },
];

function errorMessage(error: unknown, fallback = "EXPORT_FAILED") {
  return error instanceof Error ? error.message : fallback;
}

export function ProjectExportPanel({ projectId }: ProjectExportPanelProps) {
  const [readiness, setReadiness] = useState<ExportReadiness | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<ExportTarget[]>([
    "semantic_segmentation",
    "support_segmentation",
    "slice_classification",
  ]);
  const [createdExport, setCreatedExport] = useState<CreatedExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetSummary = useMemo(() => {
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

  function toggleTarget(target: ExportTarget) {
    setSelectedTargets((current) => {
      if (target === "combined") return current.includes("combined") ? [] : ["combined"];
      const withoutCombined = current.filter((item) => item !== "combined");
      if (withoutCombined.includes(target)) {
        return withoutCombined.filter((item) => item !== target);
      }
      return [...withoutCombined, target];
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
          {createdExport.downloads && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={createdExport.downloads.manifest}>Download manifest</a>
              </Button>
              <Button asChild variant="outline">
                <a href={createdExport.downloads.package}>Download package</a>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
