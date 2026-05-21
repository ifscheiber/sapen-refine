import { AppShell } from "@/components/shell/AppShell";
import { getUserFromSessionCookie } from "@/server/auth/session";
import {
  WORKSPACE_REQUEST_PATH_HEADER,
  workspaceLoginRedirectTarget,
} from "@/server/auth/workspaceRedirect";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserFromSessionCookie();
  if (!user) {
    const h = await headers();
    redirect(workspaceLoginRedirectTarget(h.get(WORKSPACE_REQUEST_PATH_HEADER)));
  }

  return <AppShell user={{ name: user.name, email: user.email }}>{children}</AppShell>;
}
