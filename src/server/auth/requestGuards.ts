export const CROSS_SITE_MUTATION_ERROR = "CROSS_SITE_MUTATION_REJECTED";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizedOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isUnsafeMethod(method: string) {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

export function isApiMutationPath(pathname: string, method: string) {
  return pathname.startsWith("/api/") && isUnsafeMethod(method);
}

export function isSameOriginMutationAllowed(params: {
  method: string;
  url: string;
  headers: Headers;
  appBaseUrl?: string | null;
}) {
  if (!isUnsafeMethod(params.method)) return true;

  const fetchSite = params.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "cross-site") return false;
  if (fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none") {
    return true;
  }

  const origin = normalizedOrigin(params.headers.get("origin"));
  if (!origin) return true;

  const requestOrigin = normalizedOrigin(params.url);
  const appOrigin = normalizedOrigin(params.appBaseUrl);
  return origin === requestOrigin || Boolean(appOrigin && origin === appOrigin);
}
