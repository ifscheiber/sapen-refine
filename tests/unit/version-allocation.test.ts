import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  VERSION_ALLOCATION_CONFLICT,
  withVersionAllocationLock,
} from "@/server/domain/versionAllocation";

describe("version allocation helper", () => {
  it("maps version unique conflicts to a stable retryable conflict", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
    } as unknown as Prisma.TransactionClient;

    const uniqueConflict = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["artifactId", "version"] },
    });

    await expect(
      withVersionAllocationLock(tx, "annotation-artifact-version:image-1:SEMANTIC_MASK:default", async () => {
        throw uniqueConflict;
      }),
    ).rejects.toMatchObject({
      code: VERSION_ALLOCATION_CONFLICT,
      status: 409,
      familyKey: "annotation-artifact-version:image-1:SEMANTIC_MASK:default",
    });
  });
});
