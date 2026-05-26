import { PROJECT_ANNOTATE_ROLES } from "@/server/auth/policies";
import { requireProjectRole } from "@/server/auth/rbac";
import { apiError, withApiErrorHandling } from "@/server/http/apiErrors";

export const POST = withApiErrorHandling(async function POST(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;

  await requireProjectRole(projectId, PROJECT_ANNOTATE_ROLES);

  return apiError("PRESIGNED_UPLOADS_DISABLED", 410);
});
