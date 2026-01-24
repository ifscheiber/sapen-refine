import { NextResponse } from "next/server";
import { requireProjectRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params; // ✅ wichtig

  const { user } = await requireProjectRole(projectId, ["OWNER", "QA", "LABELER"]);

  const body = await req.json().catch(() => null);

  const key = body?.key;
  const filename = body?.filename;
  const contentType = body?.contentType ?? null;
  const size = body?.size;

  if (!key || !filename || typeof size !== "number") {
    return NextResponse.json(
      { ok: false, error: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const image = await prisma.image.create({
    data: {
      projectId,
      storageKey: key,
      filename,
      contentType,
      size,
      createdById: user.id, // falls dein Schema das Feld hat
    },
    select: { id: true, filename: true, storageKey: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, image });
}

