import { cn } from "@/components/ui/utils";

export function AppSection({
  className,
  children,
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-md border border-[var(--border-default)] bg-[var(--workspace-panel)] p-4 text-[var(--text-primary)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
