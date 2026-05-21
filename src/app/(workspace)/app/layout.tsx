import { AppShell } from "@/components/shell/AppShell";
import { requireWorkspaceUser } from "@/server/auth/workspaceSession";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireWorkspaceUser();

  return <AppShell user={{ name: user.name, email: user.email }}>{children}</AppShell>;
}
