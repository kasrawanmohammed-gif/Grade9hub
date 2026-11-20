export function parseUtcDate(timestamp?: string | null): Date | null {
  if (!timestamp) return null;
  const trimmed = String(timestamp).trim();
  if (!trimmed) return null;

  // Already has timezone info ('Z', 'z', or '+HH:MM'/'-HH:MM' offset at end)
  const hasTimezone = /(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  let normalized = trimmed;

  // SQLite CURRENT_TIMESTAMP format: "YYYY-MM-DD HH:MM:SS" (optionally with fractional seconds)
  if (!hasTimezone && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed)) {
    normalized = `${trimmed.replace(' ', 'T')}Z`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return parsed;
}

export function formatUtcDate(
  timestamp?: string | null,
  locales?: string | string[],
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseUtcDate(timestamp);
  if (!date) return '';
  return options ? date.toLocaleDateString(locales, options) : date.toLocaleDateString(locales);
}

export function formatUtcDateTime(
  timestamp?: string | null,
  locales?: string | string[],
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseUtcDate(timestamp);
  if (!date) return '';
  return options ? date.toLocaleString(locales, options) : date.toLocaleString(locales);
}
