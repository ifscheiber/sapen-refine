import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";
import { recordAuditEvent } from "@/server/domain/audit";
import { AnnotationProjectRole } from "@prisma/client";

export async function GET() {
  const user = await requireUser();

  const projects = await prisma.annotationProject.findMany({
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

  const labelSchema = await prisma.labelSchemaVersion.findFirst({
    where: { isDefault: true, status: "ACTIVE" },
    select: { id: true },
  });

  const project = await prisma.annotationProject.create({
    data: {
      name,
      createdById: user.id,
      labelSchemaVersionId: labelSchema?.id,
      members: {
        create: {
          userId: user.id,
          role: AnnotationProjectRole.OWNER,
        },
      },
    },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  await recordAuditEvent({
    action: "PROJECT_CREATED",
    entity: "AnnotationProject",
    entityId: project.id,
    actorId: user.id,
    details: { name: project.name },
  });

  return NextResponse.json({ ok: true, project });
}
