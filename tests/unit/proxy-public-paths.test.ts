import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { isPublicPath, proxy } from "@/proxy";

describe("proxy public paths", () => {
  it("allows operational endpoints without a session", () => {
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/ready")).toBe(true);
  });

  it("allows auth and browser app assets", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/icons/icon-192.png")).toBe(true);
  });

  it("keeps workspace routes protected", () => {
    expect(isPublicPath("/app")).toBe(false);
    expect(isPublicPath("/api/projects")).toBe(false);
  });

  it("returns json 401 for unauthenticated api requests", async () => {
    const response = proxy(new NextRequest("http://localhost/api/projects"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("keeps browser pages on login redirects when unauthenticated", () => {
    const response = proxy(new NextRequest("http://localhost/app"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?next=%2Fapp");
  });

  it("keeps same-origin mutation guard ahead of api authentication", async () => {
    const response = proxy(
      new NextRequest("http://localhost/api/projects", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "CROSS_SITE_MUTATION_REJECTED",
    });
  });
});
