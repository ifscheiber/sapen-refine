import Link from "next/link";
import { BarChart3, FolderKanban, ListTodo, UploadCloud } from "lucide-react";
import type { AnnotationProjectRole } from "@prisma/client";

import { cn } from "@/components/ui/utils";
import {
  canViewCorrectionTasks,
  canViewPredictionImports,
  canViewProjectExports,
} from "@/server/auth/policies";

type ProjectOperationsNavItem = {
  key: "overview" | "tasks" | "exports" | "prediction-imports";
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function ProjectOperationsNav({
  projectId,
  current,
  role,
  orientation = "horizontal",
}: {
  projectId: string;
  current: ProjectOperationsNavItem["key"];
  role?: AnnotationProjectRole;
  orientation?: "horizontal" | "vertical";
}) {
  const items: ProjectOperationsNavItem[] = [
    {
      key: "overview",
      label: "Overview",
      href: `/app/projects/${projectId}`,
      icon: FolderKanban,
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
  const visibleItems = items.filter((item) => {
    if (!role) return true;
    if (item.key === "tasks") return canViewCorrectionTasks(role);
    if (item.key === "exports") return canViewProjectExports(role);
    if (item.key === "prediction-imports") return canViewPredictionImports(role);
    return true;
  });

  return (
    <nav
      aria-label="Project navigation"
      className={cn(
        "gap-2",
        orientation === "vertical" ? "grid" : "mb-5 flex flex-wrap",
      )}
    >
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-sm border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              active
                ? "border-[var(--accent-primary)] bg-[var(--workspace-selected)] text-[var(--text-primary)]"
                : "border-[var(--border-subtle)] bg-[var(--workspace-panel)] text-[var(--text-secondary)] hover:bg-[var(--workspace-panel-hover)] hover:text-[var(--text-primary)]",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
