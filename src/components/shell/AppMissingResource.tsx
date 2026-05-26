import Link from "next/link";
import { ArrowLeftIcon, FolderOpenIcon, ListTodoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppEmptyState } from "./AppEmptyState";

export type MissingResourceAction = "projects" | "project" | "tasks";

const ACTION_LABELS: Record<MissingResourceAction, string> = {
  projects: "Projects",
  project: "Project overview",
  tasks: "Project tasks",
};

const ACTION_ICONS: Record<MissingResourceAction, typeof ArrowLeftIcon> = {
  projects: FolderOpenIcon,
  project: ArrowLeftIcon,
  tasks: ListTodoIcon,
};

export function AppMissingResource({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: Array<{ kind: MissingResourceAction; href: string }>;
}) {
  return (
    <AppEmptyState
      title={title}
      description={description}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {actions.map((action) => {
            const Icon = ACTION_ICONS[action.kind];
            return (
              <Button key={`${action.kind}:${action.href}`} asChild variant="outline">
                <Link href={action.href}>
                  <Icon className="size-4" aria-hidden="true" />
                  {ACTION_LABELS[action.kind]}
                </Link>
              </Button>
            );
          })}
        </div>
      }
    />
  );
}
