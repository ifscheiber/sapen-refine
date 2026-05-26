import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { updateImageMetadataForUser as UpdateImageMetadataForUser } from "@/server/domain/metadata";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
let updateImageMetadataForUser: typeof UpdateImageMetadataForUser;

describe("metadata workflow persistence", () => {
  let ownerId: string;
  let viewerId: string;
  let projectId: string;
  let imageId: string;

  beforeAll(async () => {
    ({ updateImageMetadataForUser } = await import("@/server/domain/metadata"));

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const owner = await prisma.user.create({
      data: { email: `metadata-owner-${suffix}@test.local`, name: "Metadata Owner" },
      select: { id: true },
    });
    const viewer = await prisma.user.create({
      data: { email: `metadata-viewer-${suffix}@test.local`, name: "Metadata Viewer" },
      select: { id: true },
    });
    ownerId = owner.id;
    viewerId = viewer.id;

    const project = await prisma.annotationProject.create({
      data: {
        name: `Metadata Test ${suffix}`,
        createdById: ownerId,
        members: {
          create: [
            { userId: ownerId, role: "OWNER" },
            { userId: viewerId, role: "VIEWER" },
          ],
        },
      },
      select: { id: true },
    });
    projectId = project.id;

    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/metadata/${suffix}.png`,
        filename: "metadata.png",
        contentType: "image/png",
        size: 512,
        checksum: "sha256:metadata",
        width: 32,
        height: 16,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });
    imageId = image.id;
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.annotationProject.delete({ where: { id: projectId } }).catch(() => undefined);
    }
    if (ownerId) {
      await prisma.user.delete({ where: { id: ownerId } }).catch(() => undefined);
    }
    if (viewerId) {
      await prisma.user.delete({ where: { id: viewerId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
    await pool.end();
  });

  it("lets editable project members persist image-level sample and acquisition metadata", async () => {
    const bundle = await updateImageMetadataForUser(
      {
        imageId,
        userId: ownerId,
        input: {
          acquisition: {
            cameraDevice: "  Trial Camera  ",
            lightingSetup: "Light box",
            capturedAt: "2026-05-19T08:30:00.000Z",
          },
          sample: {
            tNumber: " T-050 ",
            specimenIdentifier: "Specimen-A",
            sliceIndex: "3",
          },
        },
      },
      prisma,
    );

    expect(bundle?.canEditMetadata).toBe(true);
    expect(bundle?.image.acquisitionMetadata?.cameraDevice).toBe("Trial Camera");
    expect(bundle?.image.sampleMetadata?.tNumber).toBe("T-050");
    expect(bundle?.image.sampleMetadata?.sliceIndex).toBe(3);
    expect(bundle?.completeness.overall).toBe("complete");

    const persisted = await prisma.imageAsset.findUniqueOrThrow({
      where: { id: imageId },
      select: {
        acquisitionMetadata: { select: { lightingSetup: true } },
        sampleMetadata: { select: { specimenIdentifier: true } },
      },
    });
    expect(persisted.acquisitionMetadata?.lightingSetup).toBe("Light box");
    expect(persisted.sampleMetadata?.specimenIdentifier).toBe("Specimen-A");
  });

  it("does not let viewers update metadata", async () => {
    await expect(
      updateImageMetadataForUser(
        {
          imageId,
          userId: viewerId,
          input: { sample: { tNumber: "T-VIEWER" } },
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects client attempts to edit immutable image facts", async () => {
    await expect(
      updateImageMetadataForUser(
        {
          imageId,
          userId: ownerId,
          input: { checksum: "sha256:client-owned" },
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "IMMUTABLE_OR_UNKNOWN_FIELD" });
  });
});
