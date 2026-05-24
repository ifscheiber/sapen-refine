import Link from "next/link";

import { LogoutButton } from "@/components/LogoutButton";

type TopbarUser = {
  name: string | null;
  email: string;
};

export function AppTopbar({ user }: { user: TopbarUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--shell-topbar-bg)] px-4 md:px-5">
      <div className="flex min-w-0 items-center gap-7">
        <Link
          href="/app/projects"
          className="inline-flex min-w-0 items-center gap-3 rounded-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--brand)] text-sm font-semibold text-[var(--brand-contrast)]"
          >
            S
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
              SaPen Annotate
            </span>
            <span className="block truncate text-xs text-[var(--text-muted)]">
              Ground-truth workspace
            </span>
          </span>
        </Link>
        <nav aria-label="Primary navigation" className="hidden md:block">
          <Link
            href="/app/projects"
            className="relative inline-flex h-8 items-center pb-2 text-sm font-semibold text-[var(--text-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            Projects
          </Link>
        </nav>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden min-w-0 text-right md:block">
          <div className="truncate text-xs font-semibold text-[var(--text-primary)]">
            {user.name ?? user.email}
          </div>
          <div className="truncate text-[11px] text-[var(--text-muted)]">
            {user.email}
          </div>
        </div>
        <LogoutButton className="border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--workspace-panel-hover)] hover:text-[var(--text-primary)]" />
      </div>
    </header>
  );
}
