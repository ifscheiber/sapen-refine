import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AnnotationArtifactKind,
  PrismaClient,
  type ArtifactReviewState,
} from "@prisma/client";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let review: typeof import("@/server/domain/review");

describe("review approval workflow", () => {
  let ownerId: string;
  let qaId: string;
  let labelerId: string;
  let viewerId: string;
  let projectId: string;
  let labelSchemaVersionId: string;
  let suffix: string;

  beforeAll(async () => {
    review = await import("@/server/domain/review");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [owner, qa, labeler, viewer] = await Promise.all([
      prisma.user.create({
        data: { email: `review-owner-${suffix}@test.local`, name: "Review Owner" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `review-qa-${suffix}@test.local`, name: "Review QA" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `review-labeler-${suffix}@test.local`, name: "Review Labeler" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `review-viewer-${suffix}@test.local`, name: "Review Viewer" },
        select: { id: true },
      }),
    ]);
    ownerId = owner.id;
    qaId = qa.id;
    labelerId = labeler.id;
    viewerId = viewer.id;

    const project = await prisma.annotationProject.create({
      data: {
        name: `Review Test ${suffix}`,
        labelSchemaVersionId,
        createdById: ownerId,
        members: {
          create: [
            { userId: ownerId, role: "OWNER" },
            { userId: qaId, role: "QA" },
            { userId: labelerId, role: "LABELER" },
            { userId: viewerId, role: "VIEWER" },
          ],
        },
      },
      select: { id: true },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.annotationProject.delete({ where: { id: projectId } }).catch(() => undefined);
    }
    await Promise.all(
      [ownerId, qaId, labelerId, viewerId]
        .filter(Boolean)
        .map((id) => prisma.user.delete({ where: { id } }).catch(() => undefined)),
    );
    await prisma.$disconnect();
    await pool.end();
  });

  async function createImage(name: string) {
    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/review/${suffix}-${name}.png`,
        filename: `${name}.png`,
        contentType: "image/png",
        size: 128,
        checksum: `sha256:${suffix}-${name}`,
        width: 16,
        height: 8,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });
    return image.id;
  }

  async function createArtifactVersion(
    imageId: string,
    kind: AnnotationArtifactKind,
    version = 1,
    reviewState: ArtifactReviewState = "DRAFT",
  ) {
    const artifact = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId,
        kind,
        scopeKey: "default",
        createdById: labelerId,
      },
      select: { id: true },
    });

    return prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version,
        reviewState,
        storageKey: `tests/review/${suffix}-${imageId}-${kind}-${version}.msk`,
        size: 128,
        width: 16,
        height: 8,
        labelSchemaVersionId,
        createdById: labelerId,
      },
      select: { id: true },
    });
  }

  async function createClassificationVersion(
    imageId: string,
    version = 1,
    reviewState: ArtifactReviewState = "DRAFT",
  ) {
    const slice =
      (await prisma.sliceInstance.findFirst({
        where: { projectId, imageId },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      })) ??
      (await prisma.sliceInstance.create({
        data: { projectId, imageId, createdById: labelerId },
        select: { id: true },
      }));

    return prisma.sliceClassificationVersion.create({
      data: {
        projectId,
        imageId,
        sliceInstanceId: slice.id,
        version,
        class: "COPPER_SLICE",
        reviewState,
        labelSchemaVersionId,
        createdById: labelerId,
      },
      select: { id: true },
    });
  }

  it("submits and approves semantic mask versions with append-only audit decisions", async () => {
    const imageId = await createImage("semantic");
    const version = await createArtifactVersion(imageId, AnnotationArtifactKind.SEMANTIC_MASK);

    const submit = await review.transitionArtifactVersionForUser(
      { versionId: version.id, userId: labelerId, action: "submit" },
      prisma,
    );
    expect(submit.fromState).toBe("DRAFT");
    expect(submit.toState).toBe("SUBMITTED");

    await expect(
      review.transitionArtifactVersionForUser(
        { versionId: version.id, userId: labelerId, action: "approve" },
        prisma,
      ),
    ).rejects.toBeInstanceOf(review.ReviewWorkflowError);

    const approve = await review.transitionArtifactVersionForUser(
      {
        versionId: version.id,
        userId: qaId,
        action: "approve",
        comment: "Boundary accepted",
      },
      prisma,
    );
    expect(approve.fromState).toBe("SUBMITTED");
    expect(approve.toState).toBe("APPROVED");

    const persisted = await prisma.annotationArtifactVersion.findUniqueOrThrow({
      where: { id: version.id },
      select: { reviewState: true },
    });
    expect(persisted.reviewState).toBe("APPROVED");

    const decisions = await prisma.reviewDecision.findMany({
      where: { artifactVersionId: version.id },
      orderBy: { reviewedAt: "asc" },
      select: {
        artifactVersionId: true,
        sliceClassificationVersionId: true,
        fromState: true,
        toState: true,
        reviewedById: true,
        comments: true,
      },
    });
    expect(decisions).toMatchObject([
      {
        artifactVersionId: version.id,
        sliceClassificationVersionId: null,
        fromState: "DRAFT",
        toState: "SUBMITTED",
        reviewedById: labelerId,
      },
      {
        artifactVersionId: version.id,
        sliceClassificationVersionId: null,
        fromState: "SUBMITTED",
        toState: "APPROVED",
        reviewedById: qaId,
        comments: "Boundary accepted",
      },
    ]);
  });

  it("blocks unauthorized review and requires a reject reason", async () => {
    const imageId = await createImage("support-reject");
    const version = await createArtifactVersion(imageId, AnnotationArtifactKind.SLICE_SUPPORT_MASK);

    await expect(
      review.transitionArtifactVersionForUser(
        { versionId: version.id, userId: viewerId, action: "submit" },
        prisma,
      ),
    ).rejects.toBeInstanceOf(review.ReviewWorkflowError);

    await review.transitionArtifactVersionForUser(
      { versionId: version.id, userId: ownerId, action: "submit" },
      prisma,
    );

    await expect(
      review.transitionArtifactVersionForUser(
        { versionId: version.id, userId: qaId, action: "reject" },
        prisma,
      ),
    ).rejects.toBeInstanceOf(review.ReviewWorkflowError);

    await review.transitionArtifactVersionForUser(
      {
        versionId: version.id,
        userId: qaId,
        action: "reject",
        reason: "Support mask does not cover the full slice",
      },
      prisma,
    );

    const persisted = await prisma.annotationArtifactVersion.findUniqueOrThrow({
      where: { id: version.id },
      select: { reviewState: true },
    });
    expect(persisted.reviewState).toBe("REJECTED");

    const summary = await review.loadImageReviewStateForUser({ imageId, userId: ownerId }, prisma);
    expect(summary.reviewables.supportMask.exportReady).toBe(false);
    expect(summary.exportReady).toBe(false);
  });

  it("reviews slice classifications and keeps latest approved separate from newer drafts", async () => {
    const imageId = await createImage("classification");
    const semantic = await createArtifactVersion(imageId, AnnotationArtifactKind.SEMANTIC_MASK);
    const support = await createArtifactVersion(imageId, AnnotationArtifactKind.SLICE_SUPPORT_MASK);
    const classification = await createClassificationVersion(imageId);

    for (const versionId of [semantic.id, support.id]) {
      await review.transitionArtifactVersionForUser({ versionId, userId: ownerId, action: "submit" }, prisma);
      await review.transitionArtifactVersionForUser({ versionId, userId: ownerId, action: "approve" }, prisma);
    }

    await review.transitionSliceClassificationVersionForUser(
      { versionId: classification.id, userId: labelerId, action: "submit" },
      prisma,
    );
    await review.transitionSliceClassificationVersionForUser(
      { versionId: classification.id, userId: qaId, action: "approve" },
      prisma,
    );

    const decision = await prisma.reviewDecision.findFirstOrThrow({
      where: { sliceClassificationVersionId: classification.id, toState: "APPROVED" },
      select: {
        artifactVersionId: true,
        sliceClassificationVersionId: true,
        reviewedById: true,
        toState: true,
      },
    });
    expect(decision.artifactVersionId).toBeNull();
    expect(decision.sliceClassificationVersionId).toBe(classification.id);
    expect(decision.reviewedById).toBe(qaId);
    expect(decision.toState).toBe("APPROVED");

    let summary = await review.loadImageReviewStateForUser({ imageId, userId: ownerId }, prisma);
    expect(summary.exportReady).toBe(true);
    expect(summary.reviewables.sliceClassification.latestApprovedVersion?.id).toBe(
      classification.id,
    );

    await createClassificationVersion(imageId, 2, "DRAFT");
    summary = await review.loadImageReviewStateForUser({ imageId, userId: ownerId }, prisma);
    expect(summary.exportReady).toBe(true);
    expect(summary.reviewables.sliceClassification.latestVersion?.version).toBe(2);
    expect(summary.reviewables.sliceClassification.latestVersion?.reviewState).toBe("DRAFT");
    expect(summary.reviewables.sliceClassification.latestApprovedVersion?.id).toBe(
      classification.id,
    );
  });
});
