import { AppShell } from "@/components/shell/AppShell";
import { requireUser } from "@/server/auth/rbac";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return <AppShell user={{ name: user.name, email: user.email }}>{children}</AppShell>;
}
