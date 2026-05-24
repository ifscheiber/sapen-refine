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
