import { AppMain } from "@/components/shell/AppMain";
import { AppMissingResource } from "@/components/shell/AppMissingResource";
import { AppPageHeader } from "@/components/shell/AppPageHeader";

export default function WorkspaceNotFound() {
  return (
    <AppMain>
      <AppPageHeader title="Page not found" description="SaPen Annotate" />
      <AppMissingResource
        title="This workspace page is not available"
        description="The link may be stale, mistyped, or point to a resource that was removed."
        actions={[{ kind: "projects", href: "/app/projects" }]}
      />
    </AppMain>
  );
}
