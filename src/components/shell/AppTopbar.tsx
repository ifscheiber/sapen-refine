import { LogoutButton } from "@/components/LogoutButton";

type TopbarUser = {
  name: string | null;
  email: string;
};

export function AppTopbar({ user }: { user: TopbarUser }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{user.name ?? user.email}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </div>
        <LogoutButton className="hidden md:inline-flex" />
      </div>
    </header>
  );
}
