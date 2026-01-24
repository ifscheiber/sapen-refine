"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewProjectPage() {
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
    <main className="p-6 max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">New project</h1>

      <label className="block">
        <div className="text-sm">Name</div>
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Batch 2026-01"
        />
      </label>

      {error && <div className="rounded-lg border px-3 py-2 text-sm">{error}</div>}

      <button
        className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
        disabled={loading || !name.trim()}
        onClick={create}
      >
        {loading ? "Creating..." : "Create"}
      </button>
    </main>
  );
}
