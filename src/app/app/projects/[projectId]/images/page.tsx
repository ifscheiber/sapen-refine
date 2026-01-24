import { requireProjectRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ImagesClient } from "./ui";

export default async function ImagesPage(  
	props: { params: Promise<{ projectId: string }> }
) {

  const { projectId } = await props.params;
  const { membership } = await requireProjectRole(projectId, [
	  "OWNER", 
	  "QA", 
	  "LABELER", 
	  "VIEWER"
	]);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) throw new Error("PROJECT_NOT_FOUND");

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm opacity-70">Images · Role: {membership.role}</p>
      </div>

      <ImagesClient projectId={project.id} canUpload={membership.role !== "VIEWER"} />
    </main>
  );
}
