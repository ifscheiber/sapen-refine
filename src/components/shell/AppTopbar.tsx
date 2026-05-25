import Image from "next/image";
import Link from "next/link";
import { CircleUserRound, LogOut } from "lucide-react";

import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/components/ui/utils";

type TopbarUser = {
  name: string | null;
  email: string;
};

const TOP_BAR_UTILITY_ICON_CLASSNAME = "size-4.5";

const topBarUtilityButtonClassName =
  "inline-flex h-10 w-10 items-center justify-center rounded-sm border border-transparent text-[var(--text-primary)] transition-colors hover:border-[var(--border-subtle)] hover:bg-[var(--workspace-panel-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

export function AppTopbar({ user }: { user: TopbarUser }) {
  const displayName = user.name ?? user.email;
  const signedInLabel =
    displayName === user.email ? `Signed in as ${user.email}` : `Signed in as ${displayName}, ${user.email}`;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--shell-topbar-bg)] px-5">
      <div className="flex min-w-0 items-center gap-11">
        <Link
          href="/app"
          className="inline-flex items-center rounded-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <Image
            src="/sapen-logo-grey.svg"
            alt="SaPen"
            width={132}
            height={30}
            className="block h-[30px] w-[132px] object-contain"
            priority
          />
        </Link>
        <nav aria-label="Breadcrumbs" className="hidden min-w-0 text-[11px] text-[var(--text-muted)] md:block">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li className="flex items-center gap-1.5">
              <Link
                href="/app/projects"
                className="font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Projects
              </Link>
            </li>
          </ol>
        </nav>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          role="img"
          aria-label={signedInLabel}
          title={signedInLabel}
          className={cn(topBarUtilityButtonClassName, "cursor-default hover:border-transparent hover:bg-transparent")}
        >
          <CircleUserRound className={TOP_BAR_UTILITY_ICON_CLASSNAME} aria-hidden="true" />
        </span>
        <LogoutButton
          iconOnly
          className={topBarUtilityButtonClassName}
          label="Log out"
          title="Log out"
        >
          <LogOut className={TOP_BAR_UTILITY_ICON_CLASSNAME} aria-hidden="true" />
        </LogoutButton>
      </div>
    </header>
  );
}
