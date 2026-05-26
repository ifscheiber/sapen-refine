const DEFAULT_LOGIN_REDIRECT = "/app";

export function sanitizeLoginRedirect(value: unknown, fallback = DEFAULT_LOGIN_REDIRECT) {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, "http://sapen-annotate.local");
  } catch {
    return fallback;
  }

  if (parsed.origin !== "http://sapen-annotate.local") return fallback;
  if (!parsed.pathname.startsWith("/app")) return fallback;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
