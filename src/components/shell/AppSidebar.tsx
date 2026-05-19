import Link from "next/link";

export function AppSidebar() {
  return (
    <aside className="hidden border-r bg-sidebar text-sidebar-foreground md:block">
      <div className="flex h-full flex-col">
        <div className="border-b px-5 py-4">
          <div className="text-sm font-semibold">SaPen Annotate</div>
          <div className="mt-1 text-xs text-sidebar-foreground/70">Ground-truth workspace</div>
        </div>
        <nav className="flex-1 space-y-1 p-3 text-sm">
          <Link
            className="block rounded-md px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            href="/app/projects"
          >
            Projects
          </Link>
        </nav>
      </div>
    </aside>
  );
}
