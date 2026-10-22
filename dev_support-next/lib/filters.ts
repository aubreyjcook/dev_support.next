/**
 * Ticket filter vocabulary and URL parsing.
 *
 * Kept free of database imports so client components can use these types and
 * helpers without pulling the SQLite layer into the browser bundle.
 */
import {
  ANY,
  isPriority,
  isStatus,
  type AssigneeFilter,
  type Priority,
  type Status,
} from "@/lib/constants";

export type StatusFilter = Status | typeof ANY | "active";

export interface TicketFilters {
  q: string;
  status: StatusFilter;
  priority: Priority | typeof ANY;
  assignee: AssigneeFilter;
}

export const DEFAULT_FILTERS: TicketFilters = {
  q: "",
  status: ANY,
  priority: ANY,
  assignee: "any",
};

// `searchParams` values are `string | string[] | undefined`; a repeated query
// param arrives as an array. We only ever care about the first value.
function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Normalizes raw `searchParams` into a filter object, discarding anything that
 * is not a recognized value. Unknown input can never reach SQL.
 *
 * This is the trust boundary for the query string: every value passes through a
 * type guard (`isStatus`, `isPriority`) or an explicit allow-list before it is
 * stored, and `q` is trimmed and length-capped. A `?status=admin` or a 10 KB `q`
 * therefore degrades to "no filter" rather than reaching a query.
 */
export function parseTicketFilters(
  raw: Record<string, string | string[] | undefined>,
): TicketFilters {
  const q = first(raw.q).trim().slice(0, 100);

  const rawStatus = first(raw.status);
  const status: StatusFilter =
    rawStatus === "active" || rawStatus === ANY
      ? rawStatus
      : isStatus(rawStatus)
        ? rawStatus
        : ANY;

  const rawPriority = first(raw.priority);
  const priority: Priority | typeof ANY = isPriority(rawPriority) ? rawPriority : ANY;

  const rawAssignee = first(raw.assignee);
  const assignee: AssigneeFilter =
    rawAssignee === "me" || rawAssignee === "unassigned" ? rawAssignee : "any";

  return { q, status, priority, assignee };
}

export function hasActiveFilters(filters: TicketFilters): boolean {
  return (
    filters.q.length > 0 ||
    filters.status !== ANY ||
    filters.priority !== ANY ||
    filters.assignee !== "any"
  );
}

/**
 * Stable key for a filter set. Used as a React `key` so uncontrolled filter
 * controls remount (and pick up fresh `defaultValue`s) whenever the URL
 * changes from elsewhere, e.g. after clicking "Clear".
 */
export function filterSignature(filters: TicketFilters): string {
  return [filters.q, filters.status, filters.priority, filters.assignee].join("|");
}

/** Builds the query string for a filter set, omitting defaults. */
export function filtersToSearchParams(filters: TicketFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== ANY) params.set("status", filters.status);
  if (filters.priority !== ANY) params.set("priority", filters.priority);
  if (filters.assignee !== "any") params.set("assignee", filters.assignee);
  return params.toString();
}
