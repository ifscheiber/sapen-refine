import Link from "next/link";

import { cn } from "@/components/ui/utils";
import { workspaceTabKey, type WorkspaceTab } from "./workspaceTabs";

export function WorkspacePageHeader({
  title,
  metadata,
  actions,
}: {
  title: string;
  metadata?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-5 px-4 pb-3 pt-4 md:px-8">
      <div className="min-w-0 space-y-1.5">
        <h1 className="truncate text-2xl font-bold tracking-normal text-[var(--text-primary)]">
          {title}
        </h1>
        {metadata ? <div className="min-w-0">{metadata}</div> : null}
      </div>
      {actions ? <div className="shrink-0 pt-0.5">{actions}</div> : null}
    </div>
  );
}

export function WorkspaceMetaRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-[var(--text-secondary)]">
      {children}
    </div>
  );
}

export function WorkspaceMetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
      {children}
    </span>
  );
}

export function WorkspaceContextRow({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-4 mt-3 border-y border-[var(--border-subtle)] bg-[var(--workspace-panel)] px-4 py-3 md:mx-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WorkspaceTopTabs({
  tabs,
}: {
  tabs: ReadonlyArray<WorkspaceTab>;
}) {
  return (
    <nav aria-label="Workspace navigation" className="border-b border-[var(--border-subtle)] px-4 pt-2 md:px-8">
      <div className="flex flex-wrap items-center gap-5">
        {tabs.map((tab) => (
          <Link
            key={workspaceTabKey(tab)}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "relative inline-flex h-8 items-center pb-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              tab.active
                ? "font-semibold text-[var(--text-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[var(--accent-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function WorkspaceLocalTabs({
  tabs,
}: {
  tabs: ReadonlyArray<WorkspaceTab>;
}) {
  return (
    <nav aria-label="Project workspace tabs" className="border-b border-[var(--border-subtle)] pl-4">
      <div className="flex flex-wrap items-center gap-7">
        {tabs.map((tab, index) => (
          <Link
            key={workspaceTabKey(tab)}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "relative rounded-none pb-3 pl-4 pr-4 text-sm font-semibold transition-colors first:pl-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              tab.active
                ? "text-[var(--text-primary)] after:absolute after:bottom-[-1px] after:h-0.5 after:bg-[var(--accent-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              tab.active && index === 0 ? "after:left-0 after:right-4" : "",
              tab.active && index !== 0 ? "after:left-4 after:right-4" : "",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function WorkspaceUtilityRail({ children }: { children: React.ReactNode }) {
  return <aside className="space-y-6">{children}</aside>;
}

export function WorkspaceUtilitySection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-4 border-b border-[var(--border-subtle)] pb-6 last:border-b-0 last:pb-0",
        className,
      )}
    >
      <h2 className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--text-dim)]">
        {title}
      </h2>
      <div className="pl-3">{children}</div>
    </section>
  );
}

export function WorkspacePageLayout({
  topTabs,
  header,
  contextRow,
  localTabs,
  main,
  rail,
}: {
  topTabs?: React.ReactNode;
  header: React.ReactNode;
  contextRow?: React.ReactNode;
  localTabs?: React.ReactNode;
  main: React.ReactNode;
  rail?: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-[var(--workspace-background)] text-[var(--text-primary)]">
      {topTabs}
      {header}
      {contextRow}
      <div className="px-4 py-6 pb-10 md:px-8 md:pb-6">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            {localTabs}
            {main}
          </div>
          {rail ? (
            <div className="min-w-0 border-l border-[var(--border-subtle)] pl-8">
              {rail}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
