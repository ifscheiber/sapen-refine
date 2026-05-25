const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRelativeTime(
  value: string | Date | null | undefined,
  nowInput: string | Date = new Date(),
): string {
  const date = parseDate(value);
  const now = parseDate(nowInput);
  if (!date || !now) return "date missing";

  const diffMs = now.getTime() - date.getTime();
  const absDiffMs = Math.abs(diffMs);
  const suffix = diffMs >= 0 ? "ago" : "";
  const prefix = diffMs < 0 ? "in " : "";

  if (absDiffMs < MINUTE_MS) return "now";
  if (absDiffMs < HOUR_MS) {
    return `${prefix}${Math.floor(absDiffMs / MINUTE_MS)} min ${suffix}`.trim();
  }
  if (absDiffMs < DAY_MS) {
    return `${prefix}${Math.floor(absDiffMs / HOUR_MS)} h ${suffix}`.trim();
  }
  if (absDiffMs < MONTH_MS) {
    return `${prefix}${Math.floor(absDiffMs / DAY_MS)} d ${suffix}`.trim();
  }
  return `${prefix}${Math.floor(absDiffMs / MONTH_MS)} mo ${suffix}`.trim();
}

export function formatTimestamp(
  value: string | Date | null | undefined,
  locale = "en-US",
): string {
  const date = parseDate(value);
  if (!date) return "date missing";
  return date.toLocaleString(locale, {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
