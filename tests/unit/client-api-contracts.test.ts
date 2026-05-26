import { afterEach, describe, expect, it, vi } from "vitest";

import * as imagesApi from "@/lib/imagesApi";
import * as projectsClient from "@/lib/projectsClient";

function mockFetchJson(payload: unknown, status = 200) {
  const fetchMock = vi.fn(async () => {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function firstFetchCall(fetchMock: ReturnType<typeof mockFetchJson>) {
  return fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("client API helper storage contract", () => {
  it("uploads images through the app-mediated upload route", async () => {
    const fetchMock = mockFetchJson({
      ok: true,
      image: {
        id: "image-1",
        filename: "slice sample.png",
        contentType: "image/png",
        size: 4,
        checksum: "sha256:test",
        width: 2,
        height: 2,
        validationStatus: "VALIDATED",
        createdAt: "2026-05-21T00:00:00.000Z",
      },
    });
    const file = new File(["data"], "slice sample.png", { type: "image/png" });

    const image = await projectsClient.apiUploadImage("project-1", file);
    const [url, init] = firstFetchCall(fetchMock);
    const headers = new Headers(init?.headers);

    expect(url).toBe("/api/projects/project-1/images/upload");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(file);
    expect(headers.get("content-type")).toBe("image/png");
    expect(headers.get("x-filename")).toBe("slice%20sample.png");
    expect("storageKey" in image).toBe(false);
  });

  it("does not export stale browser presign or commit helpers", () => {
    expect("apiPresignImageUpload" in projectsClient).toBe(false);
    expect("apiCommitImage" in projectsClient).toBe(false);
    expect("apiPresignMask" in imagesApi).toBe(false);
    expect("apiCommitMask" in imagesApi).toBe(false);
  });

  it("uploads semantic masks through the app-mediated mask upload route", async () => {
    const fetchMock = mockFetchJson({
      ok: true,
      maskId: "mask-1",
      versionId: "version-1",
      version: 1,
      createdAt: "2026-05-21T00:00:00.000Z",
    });
    const bytes = new Uint8Array([0, 1, 2, 3]);

    await imagesApi.apiUploadSemanticMask("image-1", {
      bytes,
      width: 2,
      height: 2,
      checksum: "sha256:test",
    });

    const [url, init] = firstFetchCall(fetchMock);
    const headers = new Headers(init?.headers);

    expect(url).toBe("/api/images/image-1/mask/upload");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(bytes);
    expect(headers.get("content-type")).toBe("application/octet-stream");
    expect(headers.get("x-mask-width")).toBe("2");
    expect(headers.get("x-mask-height")).toBe("2");
    expect(headers.get("x-mask-format")).toBe("u8raw-v1");
    expect(headers.get("x-mask-byte-length")).toBe("4");
    expect(headers.get("x-checksum")).toBe("sha256:test");
  });

  it("uploads support masks through the app-mediated support upload route", async () => {
    const fetchMock = mockFetchJson({
      ok: true,
      sliceInstance: { id: "slice-1" },
      latestSupportMask: { id: "support-version-1" },
    });
    const bytes = new Uint8Array([0, 10, 0, 10]);

    await imagesApi.apiUploadSupportMask("image-1", {
      bytes,
      width: 2,
      height: 2,
      contentType: "application/octet-stream",
    });

    const [url, init] = firstFetchCall(fetchMock);
    const headers = new Headers(init?.headers);

    expect(url).toBe("/api/images/image-1/support-mask/upload");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(bytes);
    expect(headers.get("content-type")).toBe("application/octet-stream");
    expect(headers.get("x-mask-width")).toBe("2");
    expect(headers.get("x-mask-height")).toBe("2");
    expect(headers.get("x-mask-format")).toBe("u8raw-v1");
    expect(headers.get("x-mask-byte-length")).toBe("4");
  });

  it("keeps latest-mask responses free of private storage keys", async () => {
    mockFetchJson({
      ok: true,
      exists: true,
      maskId: "mask-1",
      versionId: "version-1",
      version: 1,
      size: 4,
      width: 2,
      height: 2,
      format: "u8raw-v1",
      reviewState: "DRAFT",
      createdAt: "2026-05-21T00:00:00.000Z",
      createdBy: null,
      url: "/api/images/image-1/mask/versions/version-1/asset",
    });

    const latest = await imagesApi.apiGetLatestMask("image-1");

    expect(latest.exists).toBe(true);
    expect("key" in latest).toBe(false);
    expect("storageKey" in latest).toBe(false);
  });
});
