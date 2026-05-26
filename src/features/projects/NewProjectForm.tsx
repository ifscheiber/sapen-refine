"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSection } from "@/components/shell/AppSection";

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.error ?? "CREATE_FAILED");
      setLoading(false);
      return;
    }

    router.replace(`/app/projects/${data.project.id}`);
    router.refresh();
  }

  return (
    <AppSection className="max-w-lg space-y-4">
      <label className="block">
        <span className="text-sm">Name</span>
        <Input
          className="mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Batch 2026-01"
        />
      </label>

      {error && <div className="rounded-lg border px-3 py-2 text-sm">{error}</div>}

      <Button disabled={loading || !name.trim()} onClick={create}>
        {loading ? "Creating..." : "Create"}
      </Button>
    </AppSection>
  );
}
