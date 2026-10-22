/**
 * Domain vocabulary for the support desk.
 *
 * These constants are the single source of truth for every enum-ish value that
 * appears in the database, the UI, and validation. Database constraints in
 * `lib/db.ts` mirror the tuples below, so keep both in sync when adding a
 * value.
 */

/**
 * `as const` freezes the array literal so its element type is the union of the
 * three literal strings, not `string`. `Role` is then that exact union — the
 * compiler rejects a misspelling like `"agnt"` anywhere a `Role` is expected.
 * The same pattern defines every enum below; `isRole`/`isStatus`/… are the
 * runtime counterparts that validate *untyped* input (URLs, form data).
 */
export const ROLES = ["requester", "agent", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  requester: "Requester",
  agent: "Agent",
  admin: "Admin",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  requester: "Submits tickets and tracks their own requests.",
  agent: "Works the queue across the whole organization.",
  admin: "Full access, including user management.",
};

// Order matters: this is the ticket lifecycle, and it is also the order the
// status `<select>` presents. Keep `open` first, `closed` last.
export const STATUSES = [
  "open",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting on requester",
  resolved: "Resolved",
  closed: "Closed",
};

/** Short label used in dense tables and selects. */
export const STATUS_SHORT: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
};

export const STATUS_TONE: Record<Status, "blue" | "amber" | "violet" | "emerald" | "zinc"> = {
  open: "blue",
  in_progress: "amber",
  waiting: "violet",
  resolved: "emerald",
  closed: "zinc",
};

/** Statuses that represent unfinished work. */
export const ACTIVE_STATUSES: readonly Status[] = ["open", "in_progress", "waiting"];

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_TONE: Record<Priority, "zinc" | "blue" | "amber" | "red"> = {
  low: "zinc",
  normal: "blue",
  high: "amber",
  urgent: "red",
};

export const CATEGORIES = [
  "hardware",
  "software",
  "network",
  "accounts",
  "printing",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  hardware: "Hardware",
  software: "Software & apps",
  network: "Network & VPN",
  accounts: "Accounts & access",
  printing: "Printing",
  other: "Other",
};

export const DEFAULT_CATEGORY: Category = "other";
export const DEFAULT_PRIORITY: Priority = "normal";
export const DEFAULT_STATUS: Status = "open";

/** Filter sentinel meaning "no restriction". */
export const ANY = "all" as const;
export type Any = typeof ANY;

export type AssigneeFilter = "any" | "me" | "unassigned";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

// These `value is X` guards are type predicates: a `true` return narrows
// `unknown` to the specific union member, so callers can pass a validated value
// straight into a typed parameter. They are the bridge between untrusted input
// (searchParams, FormData) and the strict types above.

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function isAssigneeFilter(value: unknown): value is AssigneeFilter {
  return value === "any" || value === "me" || value === "unassigned";
}

/**
 * Agents and admins share queue-wide capabilities. Requesters are scoped to
 * their own tickets.
 */
export function isStaff(role: Role): boolean {
  return role === "agent" || role === "admin";
}

export function canManageUsers(role: Role): boolean {
  return role === "admin";
}

/** Name of the session cookie. Lives here so `proxy.ts` can import it without
 * pulling the database layer into the proxy runtime. */
export const SESSION_COOKIE = "hd_session";

/** Human-facing, stable ticket reference. Derived from the row id, e.g. `SUP-0001`. */
export function ticketRef(id: number): string {
  return `SUP-${String(id).padStart(4, "0")}`;
}

/**
 * Inverse of `ticketRef`: accepts the formats people actually type — `SUP-0007`,
 * `sup-7`, `SUP 7`, `7` — and returns the numeric id, or `null` when it is not
 * a reference. The ticket search uses this to short-circuit a `LIKE` scan into
 * an exact primary-key lookup.
 */
export function parseTicketRef(input: string): number | null {
  const match = /^\s*(?:sup[-_ ]?)?(\d{1,9})\s*$/i.exec(input);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
