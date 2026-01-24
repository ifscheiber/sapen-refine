import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";
import { getPresignedGetUrl } from "@/server/storage"; // gleich unten

export async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await props.params;
  const user = await requireUser();

  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true, storageKey: true, contentType: true },
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

  // Presigned GET für Objekt
  const url = await getPresignedGetUrl(image.storageKey);

  // Browser folgt Redirect und lädt Bild direkt aus MinIO
  return NextResponse.redirect(url);
}
