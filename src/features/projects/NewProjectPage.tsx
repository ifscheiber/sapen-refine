import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { AppSection } from "@/components/shell/AppSection";
import { resolveProjectCreateCapability } from "@/server/auth/rbac";
import { requireWorkspaceUser } from "@/server/auth/workspaceSession";
import { NewProjectForm } from "./NewProjectForm";

export async function NewProjectPage() {
  const user = await requireWorkspaceUser();
  const canCreateProject = await resolveProjectCreateCapability(user.id);

  if (!canCreateProject) {
    return (
      <AppMain>
        <AppPageHeader title="Project creation restricted" description="SaPen Annotate" />
        <AppSection className="max-w-lg text-sm text-[var(--text-secondary)]">
          Project creation is limited to administrators and existing project owners.
        </AppSection>
      </AppMain>
    );
  }

  return (
    <AppMain>
      <AppPageHeader title="New project" description="Create a workspace for a wood-slice image set." />
      <NewProjectForm />
    </AppMain>
  );
}
