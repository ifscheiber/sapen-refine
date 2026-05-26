export const PROJECT_RECENCY_COOKIE_NAME = "sapen_annotate_project_recency";

const MAX_RECENT_PROJECTS = 20;
const PROJECT_ID_MAX_LENGTH = 160;

type SortableProject = {
  id: string;
  name?: string | null;
  updatedAt?: string | Date | null;
};

function timestamp(value?: string | Date | null) {
  if (!value) return 0;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function projectSortLabel(project: SortableProject) {
  return (project.name ?? project.id).toLocaleLowerCase();
}

function uniqueProjectIds(ids: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || trimmed.length > PROJECT_ID_MAX_LENGTH || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= MAX_RECENT_PROJECTS) break;
  }

  return result;
}

export function decodeProjectRecencyCookie(value?: string | null): string[] {
  if (!value) return [];

  return uniqueProjectIds(
    value
      .split(",")
      .map((entry) => {
        try {
          return decodeURIComponent(entry);
        } catch {
          return "";
        }
      }),
  );
}

export function encodeProjectRecencyCookie(ids: string[]): string {
  return uniqueProjectIds(ids).map((id) => encodeURIComponent(id)).join(",");
}

export function promoteProjectInRecency(
  projectId: string,
  currentIds: string[],
  visibleProjectIds?: string[],
): string[] {
  const visible = visibleProjectIds ? new Set(visibleProjectIds) : null;
  const nextIds = [projectId, ...currentIds].filter((id) => !visible || visible.has(id));
  return uniqueProjectIds(nextIds);
}

export function sortProjectsByRecency<T extends SortableProject>(
  projects: T[],
  recencyIds: string[],
): T[] {
  const rank = new Map(recencyIds.map((id, index) => [id, index]));

  return [...projects].sort((left, right) => {
    const leftRank = rank.get(left.id);
    const rightRank = rank.get(right.id);

    if (leftRank !== undefined || rightRank !== undefined) {
      if (leftRank === undefined) return 1;
      if (rightRank === undefined) return -1;
      return leftRank - rightRank;
    }

    return (
      timestamp(right.updatedAt) -
        timestamp(left.updatedAt) ||
      projectSortLabel(left).localeCompare(projectSortLabel(right))
    );
  });
}

function readBrowserCookie(name: string) {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const entry = document.cookie.split("; ").find((cookie) => cookie.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

export function writeProjectRecencyCookie(projectId: string, visibleProjectIds: string[]) {
  if (typeof document === "undefined") return;
  const currentIds = decodeProjectRecencyCookie(readBrowserCookie(PROJECT_RECENCY_COOKIE_NAME));
  const nextIds = promoteProjectInRecency(projectId, currentIds, visibleProjectIds);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = [
    `${PROJECT_RECENCY_COOKIE_NAME}=${encodeProjectRecencyCookie(nextIds)}`,
    "Path=/",
    "Max-Age=31536000",
    "SameSite=Lax",
    secure,
  ]
    .filter(Boolean)
    .join("; ");
}
