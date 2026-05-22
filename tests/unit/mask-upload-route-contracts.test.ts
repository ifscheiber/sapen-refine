import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function routeSource(repoPath: string) {
  return readFileSync(path.join(process.cwd(), repoPath), "utf8");
}

describe("mask upload route contracts", () => {
  it("uses the shared raw mask upload request reader on all browser mask save paths", () => {
    const routes = [
      "src/app/api/images/[imageId]/mask/upload/route.ts",
      "src/app/api/images/[imageId]/support-mask/upload/route.ts",
      "src/app/api/correction-tasks/[taskId]/corrections/route.ts",
    ];

    for (const route of routes) {
      const source = routeSource(route);
      expect(source).toContain("readMaskUploadRequest");
      expect(source).not.toContain("request.text()");
      expect(source).not.toContain("req.text()");
      expect(source).not.toContain("TextDecoder");
      expect(source).not.toContain("Buffer.from(");
    }
  });
});
