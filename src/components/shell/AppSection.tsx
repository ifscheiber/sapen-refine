import { cn } from "@/components/ui/utils";

export function AppSection({
  className,
  children,
}: React.ComponentProps<"section">) {
  return (
    <section className={cn("rounded-lg border bg-card p-4 text-card-foreground", className)}>
      {children}
    </section>
  );
}
