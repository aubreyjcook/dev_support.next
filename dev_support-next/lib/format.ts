/**
 * Pure formatting helpers.
 *
 * Everything here is deterministic and dependency free so it can be unit
 * tested with `node --test` (see `tests/format.test.mjs`) and reused on the
 * server without pulling in a date library.
 *
 * All timestamps are stored and rendered in UTC. Absolute strings are
 * explicitly suffixed with "UTC" so nobody mistakes a server-rendered time for
 * their local wall clock; relative strings ("3h ago") are timezone agnostic and
 * are what the UI shows by default.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function toDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Compact relative timestamp: `just now`, `12m ago`, `3h ago`, `2d ago`,
 * `3w ago`, then an absolute short date for anything older.
 */
export function relativeTime(
  value: string | number | Date,
  now: number = Date.now(),
): string {
  const date = toDate(value);
  if (!date) return "unknown";

  const delta = now - date.getTime();

  // Future timestamps (clock skew) collapse to "just now" rather than "-2m".
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < WEEK) return `${Math.floor(delta / DAY)}d ago`;
  if (delta < 5 * WEEK) return `${Math.floor(delta / WEEK)}w ago`;

  return shortDate(date);
}

/** `12 Mar 2025` in UTC. */
export function shortDate(value: string | number | Date): string {
  const date = toDate(value);
  if (!date) return "unknown";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `12 Mar 2025, 14:05 UTC` — used for `title` tooltips. */
export function absoluteTime(value: string | number | Date): string {
  const date = toDate(value);
  if (!date) return "unknown";
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  return `${shortDate(date)}, ${time} UTC`;
}

/** ISO-8601 string for `datetime` attributes and `<time>` elements. */
export function isoString(value: string | number | Date): string {
  const date = toDate(value);
  return date ? date.toISOString() : "";
}

/** `1 message` / `3 messages`. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural ?? `${singular}s`}`;
}

/** Trims and collapses inner whitespace; useful for one-line list previews. */
export function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** `Ada Lovelace` -> `AL`; falls back to the first two characters. */
export function initials(name: string): string {
  const parts = collapse(name).split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
