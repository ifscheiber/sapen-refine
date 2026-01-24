import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";

export default async function ProjectDetail(
  props: { params: Promise<{ projectId: string }> } // <— wichtig
) {
  const { projectId } = await props.params; // <— await!
  const user = await requireUser();

  if (!projectId) return notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { where: { userId: user.id }, take: 1, select: { role: true } },
    },
  });

  if (!project || project.members.length === 0) return notFound();

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <div className="text-sm opacity-70">Role: {project.members[0].role}</div>
        </div>

        <Link className="rounded-lg border px-3 py-2 text-sm" href={`/app/projects/${project.id}/images`}>
          Images
        </Link>
      </div>
    </main>
  );
}

