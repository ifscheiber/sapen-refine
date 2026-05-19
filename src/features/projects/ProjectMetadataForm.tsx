"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProjectMetadataFormProps = {
  projectId: string;
  initialName: string;
  initialDescription: string;
  canEdit: boolean;
};

function errorMessage(error: unknown, fallback = "SAVE_FAILED") {
  return error instanceof Error ? error.message : fallback;
}

export function ProjectMetadataForm({
  projectId,
  initialName,
  initialDescription,
  canEdit,
}: ProjectMetadataFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `SAVE_FAILED_${res.status}`);

      setName(data.project.name ?? name);
      setDescription(data.project.description ?? "");
      setStatus("Project metadata saved");
      router.refresh();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <label className="grid gap-1">
        <span className="text-sm font-medium">Project name</span>
        <Input
          value={name}
          disabled={!canEdit || saving}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Project description</span>
        <Textarea
          value={description}
          disabled={!canEdit || saving}
          rows={4}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      {error && <div className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">{error}</div>}
      {status && <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">{status}</div>}

      {canEdit && (
        <div>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Save project metadata"}
          </Button>
        </div>
      )}
    </div>
  );
}
