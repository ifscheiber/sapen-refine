import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireProjectRole } from "@/server/auth/rbac";
import { withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; imageId: string }> }
) {
  const { projectId, imageId } = await ctx.params;

  await requireProjectRole(projectId, PROJECT_READ_ROLES);

  const image = await prisma.imageAsset.findFirst({
    where: { id: imageId, projectId },
    select: { id: true },
  });

  if (!image) {
    return NextResponse.json({ ok: false, error: "IMAGE_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, url: `/api/images/${image.id}/asset` });
});
