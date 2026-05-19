import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";

export async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await props.params;
  const user = await requireUser();

  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true },
  });

  if (!image) {
    return NextResponse.json({ error: "IMAGE_NOT_FOUND" }, { status: 404 });
  }

  // Authorization: User muss Projektmitglied sein
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  return NextResponse.redirect(new URL(`/api/images/${image.id}/asset`, _req.url));
}
