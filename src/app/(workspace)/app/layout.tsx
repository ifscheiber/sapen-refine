import { AppShell } from "@/components/shell/AppShell";
import { requireWorkspaceUser } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";

function formatShellDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireWorkspaceUser();
  const projects = await prisma.annotationProject.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      createdBy: { select: { email: true, name: true } },
      members: { where: { userId: user.id }, select: { role: true }, take: 1 },
      _count: { select: { images: true } },
    },
  });

  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        updatedLabel: formatShellDate(project.updatedAt),
        ownerLabel: project.createdBy?.name ?? project.createdBy?.email ?? null,
        myRole: project.members[0]?.role ?? null,
        imageCount: project._count.images,
        openReviewCount: 0,
      }))}
    >
      {children}
    </AppShell>
  );
}
