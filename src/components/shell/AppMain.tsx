import { cn } from "@/components/ui/utils";

export function AppMain({
  className,
  children,
}: React.ComponentProps<"main">) {
  return (
    <div
      className={cn(
        "min-h-full flex-1 bg-[var(--workspace-background)] px-4 py-6 pb-10 text-[var(--text-primary)] md:px-6 md:pb-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
