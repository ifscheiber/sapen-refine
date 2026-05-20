"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CirclePlay,
  ListFilter,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  UserPlus,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type ProjectRole = "OWNER" | "QA" | "LABELER" | "VIEWER";
type QueueScope = "active" | "mine" | "all";

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
  _count?: {
    predictions: number;
    tasks: number;
  };
};

type CorrectionTask = {
  id: string;
  imageId: string | null;
  status: string;
  priority: number;
  taskReason: string | null;
  uncertaintyScore: number | null;
  confidenceScore: number | null;
  modelSource: string | null;
  sourceArtifactVersionId: string | null;
  predictionRunId: string | null;
  predictionProvenanceId: string | null;
  assigneeId: string | null;
  editorHref: string | null;
  image: {
    id: string;
    filename: string | null;
    width: number | null;
    height: number | null;
    checksum: string | null;
  } | null;
  assignee: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  predictionRun: {
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
  } | null;
  predictionProvenance: {
    id: string;
    targetType: string;
    predictedClass: string | null;
    confidenceScore: number | null;
    uncertaintyScore: number | null;
    modelOutputChecksum: string | null;
  } | null;
};

type ProjectCorrectionTaskQueueProps = {
  projectId: string;
  role: ProjectRole;
};

const SCOPE_OPTIONS: Array<{ value: QueueScope; label: string }> = [
  { value: "active", label: "Active" },
  { value: "mine", label: "Mine" },
  { value: "all", label: "All" },
];

const PRIORITY_OPTIONS = [50, 60, 70, 80, 90, 100];

function errorMessage(error: unknown, fallback = "CORRECTION_TASK_FAILED") {
  return error instanceof Error ? error.message : fallback;
}

function scoreLabel(value: number | null) {
  return value === null ? "n/a" : value.toFixed(2);
}

function modelLabel(run: PredictionRunSummary | CorrectionTask["predictionRun"] | null) {
  const model = run?.modelRun;
  if (!model) return "Unknown model";
  return [model.modelFamily, model.modelName, model.modelVersion].filter(Boolean).join(" / ");
}

function runLabel(run: PredictionRunSummary) {
  const name = run.inferenceRunId ?? run.id;
  return `${name} · ${modelLabel(run)} · ${run._count?.predictions ?? 0} predictions`;
}

function targetLabel(task: CorrectionTask) {
  const target = task.predictionProvenance?.targetType ?? "UNKNOWN";
  if (target === "SLICE_CLASSIFICATION" && task.predictionProvenance?.predictedClass) {
    return `${target} · ${task.predictionProvenance.predictedClass}`;
  }
  return target;
}

export function ProjectCorrectionTaskQueue({ projectId, role }: ProjectCorrectionTaskQueueProps) {
  const [scope, setScope] = useState<QueueScope>("active");
  const [predictionRuns, setPredictionRuns] = useState<PredictionRunSummary[]>([]);
  const [selectedPredictionRunId, setSelectedPredictionRunId] = useState("");
  const [tasks, setTasks] = useState<CorrectionTask[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [priorityByTask, setPriorityByTask] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const canCreate = role === "OWNER" || role === "QA";
  const canMutate = role === "OWNER" || role === "QA" || role === "LABELER";
  const canManage = role === "OWNER" || role === "QA";

  const activeCount = useMemo(
    () => tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length,
    [tasks],
  );

  const loadPredictionRuns = useCallback(async () => {
    setLoadingRuns(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/prediction-runs`, {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `PREDICTION_RUNS_FAILED_${res.status}`);
      const runs = data.predictionRuns as PredictionRunSummary[];
      setPredictionRuns(runs);
      setSelectedPredictionRunId((current) => current || runs[0]?.id || "");
    } catch (e: unknown) {
      setError(errorMessage(e, "PREDICTION_RUNS_FAILED"));
    } finally {
      setLoadingRuns(false);
    }
  }, [projectId]);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/correction-tasks?scope=${scope}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `CORRECTION_TASKS_FAILED_${res.status}`);
      const nextTasks = data.tasks as CorrectionTask[];
      setTasks(nextTasks);
      setPriorityByTask((current) => {
        const next = { ...current };
        for (const task of nextTasks) next[task.id] = next[task.id] ?? task.priority;
        return next;
      });
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setLoadingTasks(false);
    }
  }, [projectId, scope]);

  useEffect(() => {
    void loadPredictionRuns();
  }, [loadPredictionRuns]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function createTasks() {
    if (!selectedPredictionRunId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/prediction-runs/${selectedPredictionRunId}/correction-tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `CREATE_TASKS_FAILED_${res.status}`);
      await Promise.all([loadPredictionRuns(), loadTasks()]);
    } catch (e: unknown) {
      setError(errorMessage(e, "CREATE_TASKS_FAILED"));
    } finally {
      setCreating(false);
    }
  }

  async function updateTask(taskId: string, payload: Record<string, unknown>) {
    setUpdatingTaskId(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/correction-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `UPDATE_TASK_FAILED_${res.status}`);
      await loadTasks();
    } catch (e: unknown) {
      setError(errorMessage(e, "UPDATE_TASK_FAILED"));
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:min-w-[560px]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Prediction run</span>
            <select
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedPredictionRunId}
              onChange={(event) => setSelectedPredictionRunId(event.target.value)}
              disabled={loadingRuns || creating || predictionRuns.length === 0}
            >
              {predictionRuns.length === 0 && <option value="">No prediction runs</option>}
              {predictionRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {runLabel(run)}
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={() => void createTasks()}
            disabled={!canCreate || creating || !selectedPredictionRunId}
            className="self-end"
          >
            {creating ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Create tasks
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-h-10 items-center gap-1 rounded-md border border-border bg-background p-1">
            {SCOPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setScope(option.value)}
                className={`rounded-sm px-3 py-1.5 text-sm ${
                  scope === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            onClick={() => void Promise.all([loadPredictionRuns(), loadTasks()])}
            disabled={loadingRuns || loadingTasks || creating}
          >
            <RefreshCw />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs text-muted-foreground">Visible tasks</div>
          <div className="mt-1 text-lg font-semibold">{tasks.length}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="mt-1 text-lg font-semibold">{activeCount}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-xs text-muted-foreground">Role</div>
          <div className="mt-1 text-lg font-semibold">{role}</div>
        </div>
      </div>

      {error && <div className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">{error}</div>}

      <div className="grid gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ListFilter />
          Queue
        </div>

        {loadingTasks && (
          <div className="flex min-h-24 items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
            <Loader2 className="mr-2 animate-spin" />
            Loading tasks
          </div>
        )}

        {!loadingTasks && tasks.length === 0 && (
          <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
            No correction tasks match this view.
          </div>
        )}

        {!loadingTasks && tasks.map((task) => {
          const priorityValue = priorityByTask[task.id] ?? task.priority;
          const priorityOptions = Array.from(new Set([...PRIORITY_OPTIONS, task.priority, priorityValue])).sort(
            (a, b) => a - b,
          );
          const busy = updatingTaskId === task.id;

          return (
            <div key={task.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-border px-2 py-1 text-xs font-medium">
                      {task.status}
                    </span>
                    <span className="rounded-md border border-border px-2 py-1 text-xs">
                      Priority {task.priority}
                    </span>
                    <span className="rounded-md border border-border px-2 py-1 text-xs">
                      {task.taskReason ?? "MISSING_GROUND_TRUTH"}
                    </span>
                  </div>
                  <div className="mt-3 truncate font-medium">
                    {task.image?.filename ?? task.imageId ?? "Image missing"}
                  </div>
                  <div className="mt-1 grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
                    <div>{targetLabel(task)}</div>
                    <div>{modelLabel(task.predictionRun)}</div>
                    <div>Uncertainty {scoreLabel(task.uncertaintyScore)}</div>
                    <div>Confidence {scoreLabel(task.confidenceScore)}</div>
                    <div>Assignee {task.assignee?.name ?? task.assignee?.email ?? "Unassigned"}</div>
                    <div>Run {task.predictionRun?.inferenceRunId ?? task.predictionRunId ?? "n/a"}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:max-w-[360px] lg:justify-end">
                  {task.editorHref && (
                    <Button asChild variant="outline">
                      <Link href={task.editorHref}>
                        <CirclePlay />
                        Open correction
                      </Link>
                    </Button>
                  )}
                  {canMutate && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => void updateTask(task.id, { action: "assign_to_me" })}
                        disabled={busy || task.status === "DONE" || task.status === "CANCELLED"}
                      >
                        <UserPlus />
                        Claim
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void updateTask(task.id, { action: "start" })}
                        disabled={busy || task.status === "DONE" || task.status === "CANCELLED"}
                      >
                        <CirclePlay />
                        Start
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void updateTask(task.id, { action: "dismiss" })}
                        disabled={busy || task.status === "DONE" || task.status === "CANCELLED"}
                      >
                        <XCircle />
                        Dismiss
                      </Button>
                    </>
                  )}
                  {canManage && (
                    <div className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-background px-2">
                      <select
                        className="bg-background text-sm"
                        value={priorityValue}
                        onChange={(event) => {
                          setPriorityByTask((current) => ({
                            ...current,
                            [task.id]: Number(event.target.value),
                          }));
                        }}
                      >
                        {priorityOptions.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-sm font-medium disabled:opacity-50"
                        onClick={() => void updateTask(task.id, { action: "set_priority", priority: priorityValue })}
                        disabled={busy || priorityValue === task.priority}
                      >
                        <SlidersHorizontal className="size-4" />
                        Set
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
