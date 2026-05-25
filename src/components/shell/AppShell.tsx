import { AppSidebar } from "./AppSidebar";
import { AppShellContextProvider } from "./AppShellContext";
import { AppTopbar } from "./AppTopbar";

type ShellUser = {
  name: string | null;
  email: string;
};

export type ShellProject = {
  id: string;
  name: string;
  updatedAt: string;
  updatedLabel: string;
  myRole: string | null;
  ownerLabel: string | null;
  imageCount: number;
  openReviewCount: number;
};

export function AppShell({
  user,
  projects,
  canCreateProject,
  renderedAt,
  children,
}: {
  user: ShellUser;
  projects: ShellProject[];
  canCreateProject: boolean;
  renderedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-dvh bg-[var(--app-background)] text-[var(--text-primary)]">
      <div className="flex min-h-dvh flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          <AppShellContextProvider projects={projects}>
            <AppTopbar user={user} />
            <div className="flex min-h-[calc(100dvh-3.5rem)]">
              <AppSidebar projects={projects} canCreateProject={canCreateProject} initialNow={renderedAt} />
              <main className="min-w-0 flex-1 bg-[var(--workspace-background)]">
                {children}
              </main>
            </div>
          </AppShellContextProvider>
        </div>
      </div>
    </div>
  );
}
