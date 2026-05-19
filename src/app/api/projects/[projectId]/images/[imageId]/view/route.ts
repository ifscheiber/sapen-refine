import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireProjectRole } from "@/server/auth/rbac";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; imageId: string }> }
) {
  const { projectId, imageId } = await ctx.params;

  await requireProjectRole(projectId, ["OWNER", "QA", "LABELER", "VIEWER"]);

  const image = await prisma.image.findFirst({
    where: { id: imageId, projectId },
    select: { id: true },
  });

  if (!image) {
    return NextResponse.json({ ok: false, error: "IMAGE_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, url: `/api/images/${image.id}/asset` });
}
