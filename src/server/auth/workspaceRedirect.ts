import { sanitizeLoginRedirect } from "@/server/auth/redirects";

export const WORKSPACE_REQUEST_PATH_HEADER = "x-sapen-request-path";

export function workspaceLoginRedirectTarget(requestPath: string | null | undefined) {
  const next = sanitizeLoginRedirect(requestPath, "/app");
  return `/login?next=${encodeURIComponent(next)}`;
}

