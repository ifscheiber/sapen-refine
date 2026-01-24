import Link from "next/link";
import { requireUser } from "@/server/auth/rbac"; // Pfad anpassen
import { prisma } from "@/server/db";

export default async function ProjectsPage() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      members: { where: { userId: user.id }, select: { role: true }, take: 1 },
    },
  });

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link className="rounded-lg border px-3 py-2 text-sm" href="/app/projects/new">
          New project
        </Link>
      </div>

      <div className="grid gap-3">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/app/projects/${p.id}`}
            className="rounded-xl border p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs opacity-60">{p.members[0]?.role}</div>
            </div>
          </Link>
        ))}
        {projects.length === 0 && (
          <div className="rounded-xl border p-4 text-sm opacity-70">No projects yet.</div>
        )}
      </div>
    </main>
  );
}

