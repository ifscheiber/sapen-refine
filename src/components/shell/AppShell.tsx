import Link from "next/link";

import { LogoutButton } from "@/components/LogoutButton";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";

type ShellUser = {
  name: string | null;
  email: string;
};

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="grid min-h-dvh md:grid-cols-[16rem_1fr]">
        <AppSidebar />
        <div className="flex min-w-0 flex-col">
          <AppTopbar user={user} />
          {children}
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-card p-2 md:hidden">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Link className="rounded-md px-3 py-2 text-center hover:bg-accent" href="/app/projects">
            Projects
          </Link>
          <LogoutButton className="justify-center" />
        </div>
      </nav>
    </div>
  );
}
