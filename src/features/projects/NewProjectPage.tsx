import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { NewProjectForm } from "./NewProjectForm";

export function NewProjectPage() {
  return (
    <AppMain>
      <AppPageHeader title="New project" description="Create a workspace for a wood-slice image set." />
      <NewProjectForm />
    </AppMain>
  );
}
