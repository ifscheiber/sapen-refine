import { describe, expect, it } from "vitest";

import {
  parseEditorImageRoute,
  sortEditorSidebarImages,
} from "@/components/shell/editorShellContext";

describe("editor shell context helpers", () => {
  it("parses only annotation editor image routes", () => {
    expect(parseEditorImageRoute("/app/projects/project-1/images/image-1/crop/bboxes")).toEqual({
      projectId: "project-1",
      imageId: "image-1",
      currentPath: "/app/projects/project-1/images/image-1/crop/bboxes",
    });
    expect(
      parseEditorImageRoute("/app/projects/project-1/images/image-1/slices/slice-1/crops/crop-1/semantic"),
    ).toMatchObject({
      projectId: "project-1",
      imageId: "image-1",
    });
    expect(parseEditorImageRoute("/app/projects/project-1/images/image-1")).toBeNull();
    expect(parseEditorImageRoute("/app/projects/project-1")).toBeNull();
  });

  it("sorts active editor image first and then by recent image activity", () => {
    const sorted = sortEditorSidebarImages(
      [
        { id: "image-a", filename: "A.png", updatedAt: "2026-05-20T10:00:00.000Z" },
        { id: "image-b", filename: "B.png", updatedAt: "2026-05-24T10:00:00.000Z" },
        { id: "image-c", filename: "C.png", createdAt: "2026-05-23T10:00:00.000Z" },
      ],
      "image-a",
    );

    expect(sorted.map((image) => image.id)).toEqual(["image-a", "image-b", "image-c"]);
  });
});
