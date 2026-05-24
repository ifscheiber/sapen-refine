import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireProjectRole } from "@/server/auth/rbac";
import { withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  await requireProjectRole(projectId, PROJECT_READ_ROLES);

  const images = await prisma.imageAsset.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      contentType: true,
      size: true,
      checksum: true,
      width: true,
      height: true,
      validationStatus: true,
      uploadedAt: true,
      uploadedBy: { select: { email: true, name: true } },
      sampleMetadata: { select: { tNumber: true } },
      createdAt: true,
      updatedAt: true,
      artifacts: { select: { _count: { select: { versions: true } } } },
    },
  });

  return NextResponse.json({
    ok: true,
    images: images.map(({ artifacts, ...image }) => ({
      ...image,
      maskVersionCount: artifacts.reduce((total, artifact) => total + artifact._count.versions, 0),
    })),
  });
});
