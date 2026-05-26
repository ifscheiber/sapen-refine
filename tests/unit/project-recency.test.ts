import { describe, expect, it } from "vitest";

import {
  decodeProjectRecencyCookie,
  encodeProjectRecencyCookie,
  promoteProjectInRecency,
  sortProjectsByRecency,
} from "@/components/shell/projectRecency";

describe("project recency helpers", () => {
  it("round-trips and de-duplicates project ids", () => {
    const encoded = encodeProjectRecencyCookie(["project-a", "project b", "project-a"]);

    expect(decodeProjectRecencyCookie(encoded)).toEqual(["project-a", "project b"]);
  });

  it("promotes the opened project and filters invisible projects", () => {
    expect(
      promoteProjectInRecency("project-c", ["project-a", "project-b"], [
        "project-a",
        "project-c",
      ]),
    ).toEqual(["project-c", "project-a"]);
  });

  it("sorts visible projects by last-opened order, then recent updates", () => {
    const projects = [
      { id: "project-a", name: "A", updatedAt: "2026-05-20T10:00:00.000Z" },
      { id: "project-b", name: "B", updatedAt: "2026-05-24T10:00:00.000Z" },
      { id: "project-c", name: "C", updatedAt: "2026-05-23T10:00:00.000Z" },
    ];

    expect(sortProjectsByRecency(projects, ["project-c"]).map((project) => project.id)).toEqual([
      "project-c",
      "project-b",
      "project-a",
    ]);
  });
});
