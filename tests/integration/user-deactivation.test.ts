import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { sha256Checksum } from "@/server/uploads/integrity";

loadEnv({ path: ".env.local" });

const execFileAsync = promisify(execFile);
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
let sessionAuth: typeof import("@/server/auth/session");

describe("user deactivation lifecycle", () => {
  let adminId: string;
  let targetId: string;
  let projectId: string;
  let labelSchemaVersionId: string;
  let suffix: string;

  beforeAll(async () => {
    sessionAuth = await import("@/server/auth/session");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [admin, target] = await Promise.all([
      prisma.user.create({
        data: { email: `deactivation-admin-${suffix}@test.local`, name: "Deactivation Admin" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `deactivation-target-${suffix}@test.local`, name: "Deactivation Target" },
        select: { id: true },
      }),
    ]);
    adminId = admin.id;
    targetId = target.id;

    const adminRole = await prisma.role.upsert({
      where: { name: "ADMIN" },
      update: {},
      create: { name: "ADMIN" },
      select: { id: true },
    });
    await prisma.userGlobalRole.create({ data: { userId: adminId, roleId: adminRole.id } });

    const project = await prisma.annotationProject.create({
      data: {
        name: `User Deactivation Test ${suffix}`,
        labelSchemaVersionId,
        createdById: adminId,
        members: {
          create: [
            { userId: adminId, role: "OWNER" },
            { userId: targetId, role: "LABELER" },
          ],
        },
      },
      select: { id: true },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    if (projectId) await prisma.annotationProject.delete({ where: { id: projectId } }).catch(() => undefined);
    await Promise.all(
      [targetId, adminId]
        .filter(Boolean)
        .map((id) => prisma.user.delete({ where: { id } }).catch(() => undefined)),
    );
    await prisma.$disconnect();
    await pool.end();
  });

  async function runDeactivate(email: string, reason: string) {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { id: adminId },
      select: { email: true },
    });
    return execFileAsync(
      process.execPath,
      ["scripts/deactivate-trial-user.mjs", "--email", email, "--reason", reason],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL,
          SAPEN_OPERATOR_EMAIL: admin.email,
        },
      },
    );
  }

  it("disables access while preserving attribution-bearing user rows", async () => {
    const target = await prisma.user.findUniqueOrThrow({
      where: { id: targetId },
      select: { email: true },
    });
    const token = `session-${suffix}`;
    const session = await sessionAuth.createDbSessionRecord({
      userId: targetId,
      token,
      userAgent: "deactivation-test",
      ip: "127.0.0.1",
    });
    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/user-deactivation/${suffix}/attributed.png`,
        filename: "attributed.png",
        contentType: "image/png",
        size: 4,
        checksum: sha256Checksum(new Uint8Array([1, 2, 3, 4])),
        width: 2,
        height: 2,
        validationStatus: "VALIDATED",
        uploadedById: targetId,
      },
      select: { id: true },
    });

    await runDeactivate(target.email, "access revoked after trial");

    const disabled = await prisma.user.findUniqueOrThrow({
      where: { id: targetId },
      select: { disabledAt: true, disabledById: true, disabledReason: true },
    });
    expect(disabled.disabledAt).toBeTruthy();
    expect(disabled.disabledById).toBe(adminId);
    expect(disabled.disabledReason).toBe("access revoked after trial");

    const revokedSession = await prisma.session.findUniqueOrThrow({
      where: { id: session.id },
      select: { revokedAt: true },
    });
    expect(revokedSession.revokedAt).toBeTruthy();
    await expect(sessionAuth.createDbSessionRecord({ userId: targetId, token: `new-${suffix}` })).rejects.toThrow(
      "ACCOUNT_DISABLED",
    );
    await expect(sessionAuth.getUserFromSessionToken(token)).resolves.toBeNull();

    const attributedImage = await prisma.imageAsset.findUniqueOrThrow({
      where: { id: image.id },
      select: { uploadedBy: { select: { id: true, email: true, disabledAt: true } } },
    });
    expect(attributedImage.uploadedBy).toMatchObject({
      id: targetId,
      email: target.email,
    });
    expect(attributedImage.uploadedBy?.disabledAt).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "USER_DEACTIVATED", entity: "User", entityId: targetId },
      select: { actorId: true, details: true },
    });
    expect(audit?.actorId).toBe(adminId);
    expect(audit?.details).toMatchObject({
      email: target.email,
      disabledReason: "access revoked after trial",
      actorContext: {
        triggeredBy: { type: "OPERATOR" },
        performedBy: { type: "SYSTEM", label: "deactivate-trial-user" },
      },
    });
  });

  it("does not silently update disabled users through trial user creation", async () => {
    const target = await prisma.user.findUniqueOrThrow({
      where: { id: targetId },
      select: { email: true },
    });
    const admin = await prisma.user.findUniqueOrThrow({
      where: { id: adminId },
      select: { email: true },
    });

    await expect(execFileAsync(
      process.execPath,
      ["scripts/create-trial-user.mjs", "--email", target.email, "--name", "Should Not Update"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL,
          SAPEN_OPERATOR_EMAIL: admin.email,
          SAPEN_TRIAL_USER_PASSWORD: "not-secret-test-password",
        },
      },
    )).rejects.toMatchObject({
      stderr: expect.stringContaining("User is disabled and cannot be updated"),
    });
  });
});
