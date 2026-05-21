import { prisma } from "@/server/db";
import { getUserFromSessionCookie } from "./session";
import type { AnnotationProjectRole } from "@prisma/client";

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
