import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireProjectRole } from "@/server/auth/rbac";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  await requireProjectRole(projectId, ["OWNER", "QA", "LABELER", "VIEWER"]);

  const images = await prisma.image.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      contentType: true,
      size: true,
      createdAt: true,
      storageKey: true,
    },
  });

  return NextResponse.json({ ok: true, images });
}
