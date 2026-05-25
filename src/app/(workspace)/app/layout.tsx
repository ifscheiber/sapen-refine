import { cookies } from "next/headers";

import { AppShell } from "@/components/shell/AppShell";
import {
  decodeProjectRecencyCookie,
  PROJECT_RECENCY_COOKIE_NAME,
  sortProjectsByRecency,
} from "@/components/shell/projectRecency";
import { canCreateProjectFromContext } from "@/server/auth/policies";
import { requireWorkspaceUser } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";

function formatShellDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireWorkspaceUser();
  const [projects, globalRoles, cookieStore] = await Promise.all([
    prisma.annotationProject.findMany({
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
    }),
    prisma.userGlobalRole.findMany({
      where: { userId: user.id },
      select: { role: { select: { name: true } } },
    }),
    cookies(),
  ]);
  const sortedProjects = sortProjectsByRecency(
    projects,
    decodeProjectRecencyCookie(cookieStore.get(PROJECT_RECENCY_COOKIE_NAME)?.value),
  );
  const projectRoles = sortedProjects.map((project) => project.members[0]?.role).filter((role) => Boolean(role));
  const canCreateProject = canCreateProjectFromContext({
    globalRoles: globalRoles.map((entry) => entry.role.name),
    projectRoles,
  });

  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      canCreateProject={canCreateProject}
      projects={sortedProjects.map((project) => ({
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt.toISOString(),
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
