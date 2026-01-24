import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac"; // Pfad ggf. anpassen
import { ProjectRole } from "@prisma/client";

export async function GET() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      members: {
        where: { userId: user.id },
        select: { role: true },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      myRole: p.members[0]?.role ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const user = await requireUser();

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name,
      members: {
        create: {
          userId: user.id,
          role: ProjectRole.OWNER,
        },
      },
    },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, project });
}
