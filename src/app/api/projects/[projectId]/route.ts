import { NextResponse } from "next/server";

import { requireProjectRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db";

function optionalText(value: unknown, field: string, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`${field.toUpperCase()}_INVALID`);

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw new Error(`${field.toUpperCase()}_TOO_LONG`);
  return trimmed;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  await requireProjectRole(projectId, ["OWNER", "QA"]);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "BODY_INVALID" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (key !== "name" && key !== "description") {
      return NextResponse.json({ ok: false, error: "PROJECT_FIELD_UNKNOWN" }, { status: 400 });
    }
  }

  let name: string | null | undefined;
  let description: string | null | undefined;
  try {
    name = optionalText(input.name, "name", 160);
    description = optionalText(input.description, "description", 2000);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "PROJECT_INVALID" },
      { status: 400 }
    );
  }

  if (name === null) {
    return NextResponse.json({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });
  }

  const current = await prisma.annotationProject.findUnique({
    where: { id: projectId },
    select: { labelSchemaVersionId: true },
  });
  if (!current) {
    return NextResponse.json({ ok: false, error: "PROJECT_NOT_FOUND" }, { status: 404 });
  }

  const defaultSchema = current.labelSchemaVersionId
    ? null
    : await prisma.labelSchemaVersion.findFirst({
        where: { isDefault: true, status: "ACTIVE" },
        select: { id: true },
      });

  const project = await prisma.annotationProject.update({
    where: { id: projectId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(defaultSchema ? { labelSchemaVersionId: defaultSchema.id } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      labelSchemaVersion: { select: { id: true, name: true, version: true, status: true } },
    },
  });

  return NextResponse.json({ ok: true, project });
}
