import { requireProjectRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import EditorClient from "./EditorClient";

export default async function EditImagePage(
  props: { params: Promise<{ projectId: string; imageId: string }> }
) {
  const { projectId, imageId } = await props.params;

  const { membership } = await requireProjectRole(projectId, ["OWNER", "QA", "LABELER", "VIEWER"]);

  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: { id: true, filename: true, contentType: true, size: true, projectId: true },
  });

  if (!image || image.projectId !== projectId) {
    throw new Error("IMAGE_NOT_FOUND");
  }

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Edit: {image.filename}</h1>
          <p className="text-sm opacity-70">
            {image.contentType} · {image.size} bytes · Role: {membership.role}
          </p>
        </div>
      </div>

      <EditorClient
        projectId={projectId}
        imageId={image.id}
        canEdit={membership.role !== "VIEWER"}
      />
    </main>
  );
}
