import Link from "next/link";
import { BarChart3, FolderKanban, ImageIcon, ListTodo, UploadCloud } from "lucide-react";

import { cn } from "@/components/ui/utils";

type ProjectOperationsNavItem = {
  key: "overview" | "images" | "tasks" | "exports" | "prediction-imports";
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function ProjectOperationsNav({
  projectId,
  current,
}: {
  projectId: string;
  current: ProjectOperationsNavItem["key"];
}) {
  const items: ProjectOperationsNavItem[] = [
    {
      key: "overview",
      label: "Overview",
      href: `/app/projects/${projectId}`,
      icon: FolderKanban,
    },
    {
      key: "images",
      label: "Images",
      href: `/app/projects/${projectId}/images`,
      icon: ImageIcon,
    },
    {
      key: "tasks",
      label: "Tasks",
      href: `/app/projects/${projectId}/tasks`,
      icon: ListTodo,
    },
    {
      key: "exports",
      label: "Exports",
      href: `/app/projects/${projectId}/exports`,
      icon: BarChart3,
    },
    {
      key: "prediction-imports",
      label: "Prediction Imports",
      href: `/app/projects/${projectId}/prediction-imports`,
      icon: UploadCloud,
    },
  ];

  return (
    <nav aria-label="Project navigation" className="mb-5 flex flex-wrap gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

