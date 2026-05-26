import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { cn } from "@/components/ui/utils";

export function WorkspaceSidebarSection({
  title,
  children,
  className,
  contentClassName,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "relative space-y-4 px-6 pb-6 pt-6 before:absolute before:left-6 before:right-6 before:top-0 before:h-px before:bg-[var(--border-subtle)] first:pt-0 first:before:hidden last:pb-0",
        className,
      )}
    >
      <h2 className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--text-dim)]">
        {title}
      </h2>
      <div className={cn("pl-3", contentClassName)}>{children}</div>
    </section>
  );
}

export function WorkspaceSidebarMetricRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="font-medium text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 truncate text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

export function WorkspaceSidebarEntityRow({
  href,
  selected,
  title,
  subtitle,
  titleAttr,
  subtitleTitle,
  onClick,
}: {
  href: string;
  selected: boolean;
  title: string;
  subtitle: string;
  titleAttr?: string;
  subtitleTitle?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "group relative flex min-h-[3.5rem] items-start gap-3.5 px-2 py-2.5 text-left transition-colors hover:bg-[var(--workspace-panel-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        selected
          ? "bg-[var(--workspace-selected)] text-[var(--text-primary)] before:absolute before:bottom-2.5 before:left-0 before:top-2.5 before:w-0.5 before:bg-[var(--accent-primary)]"
          : "text-[var(--text-secondary)]",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-xs font-semibold",
              selected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]",
            )}
            title={titleAttr ?? title}
          >
            {title}
          </span>
          <ChevronRightIcon
            className={cn(
              "size-4 shrink-0 text-[var(--text-dim)] transition-opacity",
              selected ? "opacity-80" : "opacity-0 group-hover:opacity-50",
            )}
            aria-hidden="true"
          />
        </span>
        <span
          className="mt-1 block truncate text-[10px] font-medium text-[var(--text-muted)]"
          title={subtitleTitle}
        >
          {subtitle}
        </span>
      </span>
    </Link>
  );
}

export const sidebarActionClassName =
  "flex min-h-8 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--workspace-panel-hover)] hover:text-[var(--text-inverse)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50";

export function ReadinessMarker({
  state,
}: {
  state: "ready" | "warning" | "blocked" | "draft";
}) {
  const className =
    state === "ready"
      ? "bg-[var(--state-ready)]"
      : state === "warning"
        ? "bg-[var(--state-warning)]"
        : state === "blocked"
          ? "bg-[var(--state-blocked)]"
          : "bg-[var(--state-draft)]";

  return (
    <span
      className={cn("mt-1.5 inline-block size-1.5 shrink-0 rounded-full", className)}
      aria-hidden="true"
    />
  );
}
