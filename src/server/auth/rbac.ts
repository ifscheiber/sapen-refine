import { prisma } from "@/server/db";
import { getUserFromSessionCookie } from "./session";
import type { AnnotationProjectRole } from "@prisma/client";
import { canCreateProjectFromContext } from "./policies";

export async function requireUser() {
  const user = await getUserFromSessionCookie();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireProjectRole(
  projectId: string,
  allowed: readonly AnnotationProjectRole[],
) {
  if (!projectId) throw new Error("PROJECT_ID_MISSING");

  const user = await requireUser();

  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { role: true, projectId: true, userId: true },
  });

  if (!membership || !allowed.includes(membership.role)) throw new Error("FORBIDDEN");

  return { user, membership };
}

export async function resolveProjectCreateCapability(userId: string) {
  const [globalRoles, projectMemberships] = await Promise.all([
    prisma.userGlobalRole.findMany({
      where: { userId },
      select: { role: { select: { name: true } } },
    }),
    prisma.annotationProjectMember.findMany({
      where: { userId },
      select: { role: true },
    }),
  ]);

  return canCreateProjectFromContext({
    globalRoles: globalRoles.map((entry) => entry.role.name),
    projectRoles: projectMemberships.map((entry) => entry.role),
  });
}

export async function requireProjectCreateCapability(userId: string) {
  if (!(await resolveProjectCreateCapability(userId))) throw new Error("FORBIDDEN");
}
