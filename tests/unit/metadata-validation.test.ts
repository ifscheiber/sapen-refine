import { beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import type * as MetadataModule from "@/server/domain/metadata";

let metadata: typeof MetadataModule;

beforeAll(async () => {
  loadEnv({ path: ".env.local" });
  metadata = await import("@/server/domain/metadata");
});

describe("metadata update validation", () => {
  it("parses partial acquisition and sample metadata", () => {
    expect(
      metadata.parseMetadataUpdate({
        acquisition: {
          cameraDevice: "  iPad Pro  ",
          capturedAt: "2026-05-19T10:00:00.000Z",
          notes: "",
        },
        sample: {
          tNumber: " T-42 ",
          sliceIndex: "2",
          replicate: null,
        },
      }),
    ).toMatchObject({
      acquisition: {
        cameraDevice: "iPad Pro",
        notes: null,
      },
      sample: {
        tNumber: "T-42",
        sliceIndex: 2,
        replicate: null,
      },
    });
  });

  it("rejects immutable or unknown top-level fields", () => {
    expect(() =>
      metadata.parseMetadataUpdate({
        checksum: "sha256:not-client-owned",
      }),
    ).toThrow(new metadata.MetadataValidationError("IMMUTABLE_OR_UNKNOWN_FIELD"));
  });

  it("rejects invalid dates and slice indices", () => {
    expect(() =>
      metadata.parseMetadataUpdate({
        acquisition: { capturedAt: "not-a-date" },
      }),
    ).toThrow(new metadata.MetadataValidationError("CAPTUREDAT_INVALID"));

    expect(() =>
      metadata.parseMetadataUpdate({
        sample: { sliceIndex: -1 },
      }),
    ).toThrow(new metadata.MetadataValidationError("SLICEINDEX_INVALID"));
  });
});

describe("metadata completeness", () => {
  it("marks validated images with checksum, dimensions, T-number, and acquisition hints complete", () => {
    expect(
      metadata.computeMetadataCompleteness({
        validationStatus: "VALIDATED",
        checksum: "sha256:abc",
        width: 2048,
        height: 1024,
        sampleMetadata: { tNumber: "T-42" },
        acquisitionMetadata: { cameraDevice: "Camera", capturedAt: null, lightingSetup: null },
      }).overall,
    ).toBe("complete");
  });

  it("keeps missing training-export metadata visible without blocking annotation outright", () => {
    const summary = metadata.computeMetadataCompleteness({
      validationStatus: "PENDING",
      checksum: null,
      width: null,
      height: null,
      sampleMetadata: { tNumber: null },
      acquisitionMetadata: null,
    });

    expect(summary.overall).toBe("not-validated");
    expect(summary.items.map((item) => [item.key, item.status])).toEqual([
      ["image-validation", "not-validated"],
      ["technical-metadata", "incomplete"],
      ["t-number", "incomplete"],
      ["acquisition-metadata", "optional-missing"],
    ]);
  });
});
