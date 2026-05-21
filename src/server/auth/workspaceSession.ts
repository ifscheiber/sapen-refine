import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AnnotationProjectRole, User } from "@prisma/client";

import { prisma } from "@/server/db";
import { getUserFromSessionCookie } from "@/server/auth/session";
import {
  WORKSPACE_REQUEST_PATH_HEADER,
  workspaceLoginRedirectTarget,
} from "@/server/auth/workspaceRedirect";

async function redirectToLoginFromWorkspace(): Promise<never> {
  const h = await headers();
  redirect(workspaceLoginRedirectTarget(h.get(WORKSPACE_REQUEST_PATH_HEADER)));
}

export async function requireWorkspaceUser(): Promise<User> {
  const user = await getUserFromSessionCookie();
  if (!user) return redirectToLoginFromWorkspace();
  return user;
}

export async function requireWorkspaceProjectRole(
  projectId: string,
  allowed: readonly AnnotationProjectRole[],
) {
  if (!projectId) throw new Error("PROJECT_ID_MISSING");

  const user = await requireWorkspaceUser();
  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { role: true, projectId: true, userId: true },
  });

  if (!membership || !allowed.includes(membership.role)) throw new Error("FORBIDDEN");

  return { user, membership };
}
