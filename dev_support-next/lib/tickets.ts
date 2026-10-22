/**
 * Ticket data access layer.
 *
 * Every read takes an explicit `Viewer` and applies its own row-level scoping,
 * so a requester can never see another requester's ticket even if a page or
 * action forgot a check. Every write is transactional and appends an entry to
 * the `events` table, which is what the ticket "Activity" timeline renders.
 */
import {
  ACTIVE_STATUSES,
  ANY,
  isCategory,
  isPriority,
  isStatus,
  isStaff,
  parseTicketRef,
  PRIORITY_LABEL,
  STATUS_LABEL,
  ticketRef,
  type Category,
  type Priority,
  type Role,
  type Status,
} from "@/lib/constants";
import { all, get, nowIso, run, transaction } from "@/lib/db";
import { DEFAULT_FILTERS, type TicketFilters } from "@/lib/filters";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** Minimum identity required to scope reads. Structurally satisfied by SessionUser. */
export interface Viewer {
  id: number;
  role: Role;
}

export interface TicketSummary {
  id: number;
  ref: string;
  subject: string;
  status: Status;
  priority: Priority;
  category: Category;
  requesterName: string;
  assigneeName: string | null;
  messageCount: number;
  /** True when the requester spoke last on a still-open ticket. */
  awaitingAgent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetail extends TicketSummary {
  description: string;
  requester: { id: number; name: string; email: string };
  assignee: { id: number; name: string } | null;
  resolvedAt: string | null;
}

export interface TicketMessage {
  id: number;
  body: string;
  visibility: "public" | "internal";
  createdAt: string;
  authorId: number;
  authorName: string;
  authorRole: Role;
}

export interface TicketEvent {
  id: number;
  type: string;
  detail: string;
  createdAt: string;
  actorName: string | null;
}

export interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  waiting: number;
  awaitingAgent: number;
  unassigned: number;
  urgent: number;
  resolvedRecent: number;
  assignedToMe: number;
}

/* -------------------------------------------------------------------------- */
/* Read helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Every ticket read shares the same column list and joins, composed from three
 * fixed pieces (SELECT_COLUMNS + SELECT_FROM + buildWhere). Keeping them as
 * constants means the "summary" shape and the "detail" shape can never drift
 * apart, and adding a column means editing exactly one place.
 *
 * The `users` table is joined three times under three aliases — requester (`ru`),
 * assignee (`au`), and last-replier (`lr`). `au`/`lr` are LEFT JOINs because a
 * ticket may be unassigned and the last reply may predate any reply column.
 */
const SELECT_COLUMNS = `
  t.id, t.subject, t.description, t.status, t.priority, t.category,
  t.requester_id, ru.name AS requester_name, ru.email AS requester_email,
  t.assignee_id, au.name AS assignee_name,
  lr.role AS last_reply_role,
  t.created_at, t.updated_at, t.resolved_at,
  (SELECT COUNT(*) FROM messages m WHERE m.ticket_id = t.id) AS message_count
`;

const SELECT_FROM = `
  FROM tickets t
  JOIN users ru ON ru.id = t.requester_id
  LEFT JOIN users au ON au.id = t.assignee_id
  LEFT JOIN users lr ON lr.id = t.last_reply_by_id
`;

interface TicketSelectRow {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  requester_id: number;
  requester_name: string;
  requester_email: string;
  assignee_id: number | null;
  assignee_name: string | null;
  last_reply_role: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  message_count: number;
}

function toStatus(value: string): Status {
  return isStatus(value) ? value : "open";
}

function toPriority(value: string): Priority {
  return isPriority(value) ? value : "normal";
}

function toCategory(value: string): Category {
  return isCategory(value) ? value : "other";
}

// The row→object mappers are the seam between SQL and the rest of the app.
// DB values arrive as untyped strings; `toStatus`/`toPriority`/`toCategory`
// re-validate them through the same guards used for user input, so a value that
// somehow bypassed the CHECK constraints degrades to a safe default instead of
// crashing the render.

function toSummary(row: TicketSelectRow): TicketSummary {
  const status = toStatus(row.status);
  return {
    id: row.id,
    ref: ticketRef(row.id),
    subject: row.subject,
    status,
    priority: toPriority(row.priority),
    category: toCategory(row.category),
    requesterName: row.requester_name,
    assigneeName: row.assignee_name,
    messageCount: Number(row.message_count ?? 0),
    // The one derived flag the whole queue runs on: still open AND the
    // requester spoke last (i.e. the team owes a reply).
    awaitingAgent:
      ACTIVE_STATUSES.includes(status) && row.last_reply_role === "requester",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDetail(row: TicketSelectRow): TicketDetail {
  return {
    ...toSummary(row),
    description: row.description,
    requester: {
      id: row.requester_id,
      name: row.requester_name,
      email: row.requester_email,
    },
    assignee:
      row.assignee_id !== null && row.assignee_name !== null
        ? { id: row.assignee_id, name: row.assignee_name }
        : null,
    resolvedAt: row.resolved_at,
  };
}

/** Escapes LIKE wildcards so user input is matched literally. */
function likePattern(input: string): string {
  // `%` and `_` are LIKE wildcards; a leading `\` is the escape char, so it
  // must be doubled too. The query pairs this with `ESCAPE '\'` below.
  return `%${input.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

interface WhereClause {
  sql: string;
  params: (string | number)[];
}

/**
 * Builds the `WHERE` clause for every ticket read, plus its bound parameters.
 *
 * This is the only place requesters' row-level scoping lives, so it can't be
 * skipped by accident. Safety comes from the split between *structure* and
 * *values*: the clause strings are fixed literals chosen by control flow, and
 * only `params` carry user data — never string concatenation — so nothing here
 * can be SQL-injected. The clause and the parameter array stay parallel, which
 * is why `listTickets` can reuse the same `where` for its `COUNT(*)` query.
 */
function buildWhere(viewer: Viewer, filters: TicketFilters): WhereClause {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  // Row-level scope: requesters only ever see their own tickets.
  if (!isStaff(viewer.role)) {
    clauses.push("t.requester_id = ?");
    params.push(viewer.id);
  }

  // `"active"` is a UI concept ("open work"), not a column value, so it expands
  // to the three statuses that count as unfinished.
  if (filters.status === "active") {
    clauses.push("t.status IN ('open', 'in_progress', 'waiting')");
  } else if (filters.status !== ANY) {
    clauses.push("t.status = ?");
    params.push(filters.status);
  }

  if (filters.priority !== ANY) {
    clauses.push("t.priority = ?");
    params.push(filters.priority);
  }

  if (filters.assignee === "me") {
    clauses.push("t.assignee_id = ?");
    params.push(viewer.id);
  } else if (filters.assignee === "unassigned") {
    clauses.push("t.assignee_id IS NULL");
  }

  // Search: a recognizable ticket reference becomes an exact id lookup (fast);
  // anything else becomes a case-insensitive LIKE over subject + description.
  if (filters.q) {
    const asRef = parseTicketRef(filters.q);
    if (asRef !== null) {
      clauses.push("t.id = ?");
      params.push(asRef);
    } else {
      const pattern = likePattern(filters.q);
      clauses.push(
        "(t.subject LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\')",
      );
      params.push(pattern, pattern);
    }
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export interface TicketListResult {
  tickets: TicketSummary[];
  total: number;
  limited: boolean;
}

/**
 * Lists tickets visible to `viewer`. Capped at `limit` rows (default 100) —
 * plenty for a small organization and keeps the payload predictable.
 */
export function listTickets(
  viewer: Viewer,
  filters: TicketFilters = DEFAULT_FILTERS,
  limit = 100,
): TicketListResult {
  const where = buildWhere(viewer, filters);

  const rows = all<TicketSelectRow>(
    `SELECT ${SELECT_COLUMNS} ${SELECT_FROM} ${where.sql}
     ORDER BY t.updated_at DESC, t.id DESC
     LIMIT ?`,
    [...where.params, limit],
  );

  const countRow = get<{ total: number }>(
    `SELECT COUNT(*) AS total FROM tickets t ${where.sql}`,
    where.params,
  );
  const total = Number(countRow?.total ?? 0);

  return {
    tickets: rows.map(toSummary),
    total,
    limited: total > rows.length,
  };
}

/** Returns a ticket only if `viewer` is allowed to see it. */
export function getTicketDetail(id: number, viewer: Viewer): TicketDetail | null {
  const clauses = ["t.id = ?"];
  const params: (string | number)[] = [id];

  if (!isStaff(viewer.role)) {
    clauses.push("t.requester_id = ?");
    params.push(viewer.id);
  }

  const row = get<TicketSelectRow>(
    `SELECT ${SELECT_COLUMNS} ${SELECT_FROM} WHERE ${clauses.join(" AND ")}`,
    params,
  );
  return row ? toDetail(row) : null;
}

/** Public messages only, unless the viewer is staff. */
export function listMessages(ticketId: number, viewer: Viewer): TicketMessage[] {
  const rows = all<{
    id: number;
    body: string;
    visibility: string;
    created_at: string;
    author_id: number;
    author_name: string;
    author_role: string;
  }>(
    `SELECT m.id, m.body, m.visibility, m.created_at,
            u.id AS author_id, u.name AS author_name, u.role AS author_role
       FROM messages m
       JOIN users u ON u.id = m.author_id
      WHERE m.ticket_id = ?
        AND (m.visibility = 'public' OR ? = 1)
      ORDER BY m.created_at ASC, m.id ASC`,
    [ticketId, isStaff(viewer.role) ? 1 : 0],
  );

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    visibility: row.visibility === "internal" ? "internal" : "public",
    createdAt: row.created_at,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: (row.author_role === "admin" || row.author_role === "agent"
      ? row.author_role
      : "requester") as Role,
  }));
}

export function listEvents(ticketId: number): TicketEvent[] {
  const rows = all<{
    id: number;
    type: string;
    detail: string;
    created_at: string;
    actor_name: string | null;
  }>(
    `SELECT e.id, e.type, e.detail, e.created_at, u.name AS actor_name
       FROM events e
       LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.ticket_id = ?
      ORDER BY e.created_at ASC, e.id ASC`,
    [ticketId],
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    detail: row.detail,
    createdAt: row.created_at,
    actorName: row.actor_name,
  }));
}

/* -------------------------------------------------------------------------- */
/* Aggregates                                                                  */
/* -------------------------------------------------------------------------- */

export function getStats(viewer: Viewer): TicketStats {
  const staff = isStaff(viewer.role);
  const resolvedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const row = get<Record<string, number | null>>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END), 0) AS open,
       COALESCE(SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END), 0) AS in_progress,
       COALESCE(SUM(CASE WHEN t.status = 'waiting' THEN 1 ELSE 0 END), 0) AS waiting,
       COALESCE(SUM(CASE WHEN t.status IN ('open', 'in_progress', 'waiting')
                          AND t.last_reply_by_id = t.requester_id THEN 1 ELSE 0 END), 0) AS awaiting_agent,
       COALESCE(SUM(CASE WHEN t.status IN ('open', 'in_progress', 'waiting')
                          AND t.assignee_id IS NULL THEN 1 ELSE 0 END), 0) AS unassigned,
       COALESCE(SUM(CASE WHEN t.status IN ('open', 'in_progress', 'waiting')
                          AND t.priority = 'urgent' THEN 1 ELSE 0 END), 0) AS urgent,
       COALESCE(SUM(CASE WHEN t.resolved_at IS NOT NULL AND t.resolved_at >= ?
                          THEN 1 ELSE 0 END), 0) AS resolved_recent
     FROM tickets t
     ${staff ? "" : "WHERE t.requester_id = ?"}`,
    staff ? [resolvedCutoff] : [resolvedCutoff, viewer.id],
  );

  const assignedRow = staff
    ? get<{ count: number }>(
        `SELECT COUNT(*) AS count FROM tickets t
          WHERE t.assignee_id = ? AND t.status IN ('open', 'in_progress', 'waiting')`,
        [viewer.id],
      )
    : undefined;

  const value = (key: string): number => Number(row?.[key] ?? 0);

  return {
    total: value("total"),
    open: value("open"),
    inProgress: value("in_progress"),
    waiting: value("waiting"),
    awaitingAgent: value("awaiting_agent"),
    unassigned: value("unassigned"),
    urgent: value("urgent"),
    resolvedRecent: value("resolved_recent"),
    assignedToMe: Number(assignedRow?.count ?? 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

interface Actor {
  id: number;
  name: string;
}

interface TicketStateRow {
  id: number;
  status: string;
  priority: string;
  category: string;
  assignee_id: number | null;
  assignee_name: string | null;
  resolved_at: string | null;
}

/**
 * Reads the mutable columns every writer needs to decide what changed. All the
 * property setters call this *inside* their transaction so the read and the
 * write are atomic — a second agent's change can't slip in between.
 */
function ticketState(ticketId: number): TicketStateRow | undefined {
  return get<TicketStateRow>(
    `SELECT t.id, t.status, t.priority, t.category, t.assignee_id, au.name AS assignee_name, t.resolved_at
       FROM tickets t
       LEFT JOIN users au ON au.id = t.assignee_id
      WHERE t.id = ?`,
    [ticketId],
  );
}

function recordEvent(
  ticketId: number,
  actorId: number | null,
  type: string,
  detail: string,
  at: string,
): void {
  run(
    "INSERT INTO events (ticket_id, actor_id, type, detail, created_at) VALUES (?, ?, ?, ?, ?)",
    [ticketId, actorId, type, detail, at],
  );
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  priority: Priority;
  category: Category;
  requester: Actor;
}

// A new ticket is born `open`, unassigned, with the requester as last speaker —
// which is exactly the "awaiting a first reply" state the queue surfaces.
export function createTicket(input: CreateTicketInput): number {
  return transaction(() => {
    const now = nowIso();
    const result = run(
      `INSERT INTO tickets
         (subject, description, status, priority, category, requester_id, assignee_id,
          last_reply_by_id, created_at, updated_at, resolved_at)
       VALUES (?, ?, 'open', ?, ?, ?, NULL, ?, ?, ?, NULL)`,
      [
        input.subject,
        input.description,
        input.priority,
        input.category,
        input.requester.id,
        // The requester spoke last: the ticket is now awaiting a first reply.
        input.requester.id,
        now,
        now,
      ],
    );
    recordEvent(result.lastInsertRowid, input.requester.id, "created", "created this ticket", now);
    return result.lastInsertRowid;
  });
}

export interface AddMessageInput {
  ticketId: number;
  author: Actor & { role: Role };
  body: string;
  visibility: "public" | "internal";
}

/**
 * Appends a message. A public reply from the requester automatically reopens a
 * waiting/resolved/closed ticket — the conversation moving means the work moved.
 * Internal notes never change the "awaiting reply" signal.
 */
export function addMessage(input: AddMessageInput): void {
  transaction(() => {
    const state = ticketState(input.ticketId);
    if (!state) throw new Error("Ticket not found");

    const now = nowIso();
    run(
      "INSERT INTO messages (ticket_id, author_id, body, visibility, created_at) VALUES (?, ?, ?, ?, ?)",
      [input.ticketId, input.author.id, input.body, input.visibility, now],
    );

    if (input.visibility !== "public") {
      run("UPDATE tickets SET updated_at = ? WHERE id = ?", [now, input.ticketId]);
      return;
    }

    const shouldReopen =
      input.author.role === "requester" &&
      (state.status === "waiting" || state.status === "resolved" || state.status === "closed");

    if (shouldReopen) {
      run(
        "UPDATE tickets SET status = 'open', resolved_at = NULL, last_reply_by_id = ?, updated_at = ? WHERE id = ?",
        [input.author.id, now, input.ticketId],
      );
      recordEvent(
        input.ticketId,
        input.author.id,
        "status",
        `reopened this ticket by replying (was ${STATUS_LABEL[toStatus(state.status)]})`,
        now,
      );
    } else {
      run("UPDATE tickets SET last_reply_by_id = ?, updated_at = ? WHERE id = ?", [
        input.author.id,
        now,
        input.ticketId,
      ]);
    }
  });
}

// The three property setters below share one shape: read current state, do
// nothing if unchanged, write, then record a human-readable event for the
// Activity panel. `resolved_at` is maintained specially — stamped when entering
// `resolved`, cleared when moving back to an active status, and left untouched
// when moving between `resolved` and `closed`.
export function setTicketStatus(ticketId: number, status: Status, actor: Actor): void {
  transaction(() => {
    const state = ticketState(ticketId);
    if (!state) throw new Error("Ticket not found");

    const previous = toStatus(state.status);
    if (previous === status) return;

    const now = nowIso();
    const resolvedAt =
      status === "resolved"
        ? now
        : ACTIVE_STATUSES.includes(status)
          ? null
          : state.resolved_at;

    run("UPDATE tickets SET status = ?, resolved_at = ?, updated_at = ? WHERE id = ?", [
      status,
      resolvedAt,
      now,
      ticketId,
    ]);
    recordEvent(
      ticketId,
      actor.id,
      "status",
      `changed status from ${STATUS_LABEL[previous]} to ${STATUS_LABEL[status]}`,
      now,
    );
  });
}

/** Priority is pure triage metadata; changing it bumps `updated_at` so the
 * ticket surfaces at the top of the activity-sorted queue. */
export function setTicketPriority(ticketId: number, priority: Priority, actor: Actor): void {
  transaction(() => {
    const state = ticketState(ticketId);
    if (!state) throw new Error("Ticket not found");

    const previous = toPriority(state.priority);
    if (previous === priority) return;

    const now = nowIso();
    run("UPDATE tickets SET priority = ?, updated_at = ? WHERE id = ?", [
      priority,
      now,
      ticketId,
    ]);
    recordEvent(
      ticketId,
      actor.id,
      "priority",
      `changed priority from ${PRIORITY_LABEL[previous]} to ${PRIORITY_LABEL[priority]}`,
      now,
    );
  });
}

/** Category changes are informational; the event records the fact without the
 * old value (the label alone is enough context). */
export function setTicketCategory(ticketId: number, category: Category, actor: Actor): void {
  transaction(() => {
    const state = ticketState(ticketId);
    if (!state) throw new Error("Ticket not found");

    const previous = toCategory(state.category);
    if (previous === category) return;

    const now = nowIso();
    run("UPDATE tickets SET category = ?, updated_at = ? WHERE id = ?", [
      category,
      now,
      ticketId,
    ]);
    recordEvent(ticketId, actor.id, "category", "updated the category", now);
  });
}

/**
 * Assigns (or unassigns) a ticket. Assignment also claims an untouched open
 * ticket by moving it to "In progress", which keeps the queue honest.
 */
export function setTicketAssignee(
  ticketId: number,
  assignee: { id: number; name: string } | null,
  actor: Actor,
): void {
  transaction(() => {
    const state = ticketState(ticketId);
    if (!state) throw new Error("Ticket not found");

    const now = nowIso();
    const previousStatus = toStatus(state.status);
    const claim = assignee !== null && previousStatus === "open";

    run("UPDATE tickets SET assignee_id = ?, updated_at = ? WHERE id = ?", [
      assignee?.id ?? null,
      now,
      ticketId,
    ]);

    recordEvent(
      ticketId,
      actor.id,
      "assignee",
      assignee ? `assigned this ticket to ${assignee.name}` : "unassigned this ticket",
      now,
    );

    if (claim) {
      run("UPDATE tickets SET status = 'in_progress' WHERE id = ?", [ticketId]);
      recordEvent(ticketId, actor.id, "status", "changed status from Open to In progress", now);
    }
  });
}
