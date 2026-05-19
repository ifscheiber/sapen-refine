import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/proxy";

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
});
