export type WorkspaceTab = {
  keyId?: string;
  label: string;
  href: string;
  active?: boolean;
};

export function workspaceTabKey(tab: WorkspaceTab) {
  return tab.keyId ?? `${tab.label}:${tab.href}`;
}
