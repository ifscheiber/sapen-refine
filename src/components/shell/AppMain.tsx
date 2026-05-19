import { cn } from "@/components/ui/utils";

export function AppMain({
  className,
  children,
}: React.ComponentProps<"main">) {
  return (
    <main className={cn("flex-1 px-4 py-6 pb-20 md:px-6 md:pb-6", className)}>
      {children}
    </main>
  );
}
