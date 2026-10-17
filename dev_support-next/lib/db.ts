/**
 * SQLite persistence layer.
 *
 * Design notes
 * ------------
 * - Uses Node's built-in `node:sqlite` (Node >= 24). No native build step, no
 *   third-party driver, no install-time compilation, no npm dependency.
 * - The database file lives in `data/` by default and is created, migrated and
 *   seeded on first access. Override the location with `DATABASE_PATH`.
 * - Access is deliberately synchronous: for a single-node internal tool this
 *   is simpler, faster, and avoids connection pooling. Next.js runs all of it
 *   on the Node.js runtime, and every read happens after a request-time API
 *   (`cookies()`), so nothing is captured during prerender. See
 *   `docs/architecture.md` -> "Why synchronous SQLite is safe here".
 * - Migrations are forward-only and tracked with `PRAGMA user_version`.
 *
 * Keep the CHECK constraints below in sync with `lib/constants.ts`.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import { hashPassword } from "@/lib/password";

const DEFAULT_DB_PATH = join(process.cwd(), "data", "helpdesk.db");

/**
 * Resolves the database location.
 *
 * Deliberately returns the configured value verbatim instead of joining it with
 * `process.cwd()`: Turbopack's static analysis cannot prove such a path is
 * scoped to a subdirectory and would trace the entire project into the server
 * bundle. A relative `DATABASE_PATH` is still resolved by the OS against the
 * working directory when the file is opened.
 */
function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  return configured ? configured : DEFAULT_DB_PATH;
}

export const DB_PATH = resolveDbPath();

/**
 * Forward-only migrations. Append new entries; never edit a shipped one.
 * `user_version` tracks how many have been applied.
 */
const MIGRATIONS: readonly string[] = [
  /* 1 -> initial schema */ `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'requester'
                    CHECK (role IN ('requester', 'agent', 'admin')),
    password_hash TEXT NOT NULL,
    is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at    TEXT NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX sessions_user_idx ON sessions(user_id);

  CREATE TABLE tickets (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    subject          TEXT NOT NULL,
    description      TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
    priority         TEXT NOT NULL DEFAULT 'normal'
                       CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    category         TEXT NOT NULL DEFAULT 'other'
                       CHECK (category IN ('hardware', 'software', 'network', 'accounts', 'printing', 'other')),
    requester_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assignee_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    last_reply_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    resolved_at      TEXT
  );
  CREATE INDEX tickets_status_idx ON tickets(status);
  CREATE INDEX tickets_assignee_idx ON tickets(assignee_id);
  CREATE INDEX tickets_requester_idx ON tickets(requester_id);
  CREATE INDEX tickets_updated_idx ON tickets(updated_at DESC);

  CREATE TABLE messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'public'
                 CHECK (visibility IN ('public', 'internal')),
    created_at TEXT NOT NULL
  );
  CREATE INDEX messages_ticket_idx ON messages(ticket_id, created_at);

  CREATE TABLE events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    actor_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type       TEXT NOT NULL,
    detail     TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX events_ticket_idx ON events(ticket_id, created_at);
  `,
] as const;

interface GlobalWithDb {
  __helpdeskDb?: DatabaseSync;
  __helpdeskMigrated?: boolean;
}

const globalForDb = globalThis as unknown as GlobalWithDb;

function migrate(db: DatabaseSync): void {
  const row = db.prepare("PRAGMA user_version").get() as
    | { user_version?: number }
    | undefined;
  const current = Number(row?.user_version ?? 0);

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    const sql = MIGRATIONS[version];
    db.exec("BEGIN");
    try {
      db.exec(sql);
      // PRAGMA does not accept bound parameters; `version` is a loop index.
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

function openDatabase(): DatabaseSync {
  const file = resolveDbPath();
  mkdirSync(dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");

  migrate(db);
  if (process.env.SEED_DEMO !== "false") seedDemoData(db);
  return db;
}

/** Process-wide singleton (also survives Next.js dev-server HMR reloads). */
export function getDb(): DatabaseSync {
  if (!globalForDb.__helpdeskDb) {
    globalForDb.__helpdeskDb = openDatabase();
    globalForDb.__helpdeskMigrated = true;
  }
  return globalForDb.__helpdeskDb;
}

/* -------------------------------------------------------------------------- */
/* Thin typed query helpers                                                    */
/* -------------------------------------------------------------------------- */

export function all<T>(sql: string, params: SQLInputValue[] = []): T[] {
  return getDb().prepare(sql).all(...params) as unknown as T[];
}

export function get<T>(sql: string, params: SQLInputValue[] = []): T | undefined {
  return getDb().prepare(sql).get(...params) as unknown as T | undefined;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export function run(sql: string, params: SQLInputValue[] = []): RunResult {
  const result = getDb().prepare(sql).run(...params);
  return {
    changes: Number(result.changes),
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

/** Runs `fn` inside a transaction, rolling back if it throws. */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

/* -------------------------------------------------------------------------- */
/* Demo seed                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Inserts a small, realistic dataset the first time the database is created.
 * Disable with `SEED_DEMO=false` (e.g. on a real deployment) or reset with
 * `npm run db:reset`.
 */
function seedDemoData(db: DatabaseSync): void {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM users").get() as
    | { count?: number }
    | undefined;
  if (Number(existing?.count ?? 0) > 0) return;

  const password = process.env.SEED_PASSWORD ?? "helpdesk123";
  const passwordHash = hashPassword(password);
  const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  db.exec("BEGIN");
  try {
    const insertUser = db.prepare(
      "INSERT INTO users (email, name, role, password_hash, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
    );
    const user = (email: string, name: string, role: string): number => {
      const result = insertUser.run(email, name, role, passwordHash, iso(-30 * DAY));
      return Number(result.lastInsertRowid);
    };

    const ada = user("ada@helpdesk.local", "Ada Chen", "admin");
    const maya = user("maya@helpdesk.local", "Maya Okafor", "agent");
    const julian = user("julian@helpdesk.local", "Julian Reyes", "agent");
    const nina = user("nina@helpdesk.local", "Nina Patel", "requester");
    const owen = user("owen@helpdesk.local", "Owen Brooks", "requester");

    const insertTicket = db.prepare(`
      INSERT INTO tickets
        (subject, description, status, priority, category, requester_id, assignee_id,
         last_reply_by_id, created_at, updated_at, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMessage = db.prepare(
      "INSERT INTO messages (ticket_id, author_id, body, visibility, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    const insertEvent = db.prepare(
      "INSERT INTO events (ticket_id, actor_id, type, detail, created_at) VALUES (?, ?, ?, ?, ?)",
    );

    interface SeedMessage {
      author: number;
      body: string;
      visibility?: "public" | "internal";
      at: string;
    }

    interface SeedTicket {
      subject: string;
      description: string;
      status: string;
      priority: string;
      category: string;
      requester: number;
      assignee: number | null;
      lastReplyBy: number;
      createdAt: string;
      updatedAt: string;
      resolvedAt?: string | null;
      messages: SeedMessage[];
      events: { actor: number | null; type: string; detail: string; at: string }[];
    }

    const tickets: SeedTicket[] = [
      {
        subject: "Laptop will not boot after BIOS update",
        description:
          "Ran the recommended BIOS update from the vendor tool last night. This morning the machine powers on, shows the vendor splash screen and then restarts in a loop. I have a client call at 11:00 and cannot get to my files.",
        status: "open",
        priority: "high",
        category: "hardware",
        requester: nina,
        assignee: null,
        lastReplyBy: nina,
        createdAt: iso(-3 * HOUR),
        updatedAt: iso(-3 * HOUR),
        messages: [],
        events: [{ actor: nina, type: "created", detail: "created this ticket", at: iso(-3 * HOUR) }],
      },
      {
        subject: "VPN disconnects every 20 minutes when working from home",
        description:
          "The VPN client drops roughly every 20 minutes on my home connection. Reconnecting works but it interrupts calls and drops file uploads. Home router is a stock ISP unit, wired connection.",
        status: "in_progress",
        priority: "urgent",
        category: "network",
        requester: owen,
        assignee: maya,
        lastReplyBy: maya,
        createdAt: iso(-26 * HOUR),
        updatedAt: iso(-2 * HOUR),
        messages: [
          {
            author: maya,
            body: "Thanks Owen. I can see repeated renegotiation in the gateway logs, which usually points at MTU size. Can you run `netsh interface ipv4 show subinterfaces` and paste the MTU column for your adapter?",
            at: iso(-5 * HOUR),
          },
          {
            author: owen,
            body: "MTU shows 1500 on the Ethernet adapter. The VPN adapter is not listed while disconnected — do you want me to reconnect and run it again?",
            at: iso(-2 * HOUR),
          },
        ],
        events: [
          { actor: owen, type: "created", detail: "created this ticket", at: iso(-26 * HOUR) },
          { actor: maya, type: "assignee", detail: "assigned this ticket to Maya Okafor", at: iso(-20 * HOUR) },
          { actor: maya, type: "status", detail: "changed status to In progress", at: iso(-20 * HOUR) },
          { actor: maya, type: "priority", detail: "raised priority to Urgent", at: iso(-5 * HOUR) },
        ],
      },
      {
        subject: "Access to the finance shared drive",
        description:
          "I have moved onto the reporting team and need read access to the Finance shared drive for the quarterly close. My manager, Priya, has approved this by email.",
        status: "waiting",
        priority: "normal",
        category: "accounts",
        requester: nina,
        assignee: julian,
        lastReplyBy: julian,
        createdAt: iso(-2 * DAY),
        updatedAt: iso(-18 * HOUR),
        messages: [
          {
            author: julian,
            body: "Happy to set this up. Please reply with the name of the folder you need and whether read-only is enough, then I can complete the request.",
            visibility: "public",
            at: iso(-18 * HOUR),
          },
        ],
        events: [
          { actor: nina, type: "created", detail: "created this ticket", at: iso(-2 * DAY) },
          { actor: julian, type: "assignee", detail: "assigned this ticket to Julian Reyes", at: iso(-1 * DAY) },
          { actor: julian, type: "status", detail: "changed status to Waiting on requester", at: iso(-18 * HOUR) },
        ],
      },
      {
        subject: "Excel crashes when opening the Q3 forecast workbook",
        description:
          "Spreadsheet opens, recalculates, then Excel closes without an error. The file is about 40 MB with a lot of pivot tables. Other workbooks open fine.",
        status: "resolved",
        priority: "normal",
        category: "software",
        requester: owen,
        assignee: maya,
        lastReplyBy: maya,
        createdAt: iso(-5 * DAY),
        updatedAt: iso(-2 * DAY),
        resolvedAt: iso(-2 * DAY),
        messages: [
          {
            author: maya,
            body: "This matches a known issue with the 32-bit Office build and large workbooks. I have installed the 64-bit build on your machine — please try the workbook again and let me know.",
            at: iso(-2 * DAY - 3 * HOUR),
          },
          {
            author: owen,
            body: "Opened it three times, no crash. Thank you!",
            at: iso(-2 * DAY + 2 * HOUR),
          },
          {
            author: maya,
            body: "Internal: tracked under INC-2291 for the licence swap. Closing after the requester confirmed.",
            visibility: "internal",
            at: iso(-2 * DAY + 3 * HOUR),
          },
        ],
        events: [
          { actor: owen, type: "created", detail: "created this ticket", at: iso(-5 * DAY) },
          { actor: maya, type: "assignee", detail: "assigned this ticket to Maya Okafor", at: iso(-5 * DAY + HOUR) },
          { actor: maya, type: "status", detail: "changed status to Resolved", at: iso(-2 * DAY) },
        ],
      },
      {
        subject: "Second monitor not detected on the dock",
        description:
          "The external monitor stays black when docked. HDMI direct to the laptop works. Docking station is the USB-C model in meeting room 2.",
        status: "closed",
        priority: "low",
        category: "hardware",
        requester: nina,
        assignee: julian,
        lastReplyBy: julian,
        createdAt: iso(-9 * DAY),
        updatedAt: iso(-7 * DAY),
        resolvedAt: iso(-8 * DAY),
        messages: [
          {
            author: julian,
            body: "The dock firmware was two revisions behind. Updated it and both displays came up. Closed — reopen if it returns.",
            at: iso(-8 * DAY),
          },
        ],
        events: [
          { actor: nina, type: "created", detail: "created this ticket", at: iso(-9 * DAY) },
          { actor: julian, type: "status", detail: "changed status to Resolved", at: iso(-8 * DAY) },
          { actor: julian, type: "status", detail: "changed status to Closed", at: iso(-7 * DAY) },
        ],
      },
      {
        subject: "Floor 2 printer jams on every duplex job",
        description:
          "Every two-sided job jams in tray 2. Single-sided prints are fine. About a dozen people on the floor are affected.",
        status: "open",
        priority: "normal",
        category: "printing",
        requester: owen,
        assignee: null,
        lastReplyBy: owen,
        createdAt: iso(-6 * HOUR),
        updatedAt: iso(-6 * HOUR),
        messages: [],
        events: [{ actor: owen, type: "created", detail: "created this ticket", at: iso(-6 * HOUR) }],
      },
    ];

    for (const ticket of tickets) {
      const result = insertTicket.run(
        ticket.subject,
        ticket.description,
        ticket.status,
        ticket.priority,
        ticket.category,
        ticket.requester,
        ticket.assignee,
        ticket.lastReplyBy,
        ticket.createdAt,
        ticket.updatedAt,
        ticket.resolvedAt ?? null,
      );
      const ticketId = Number(result.lastInsertRowid);

      for (const message of ticket.messages) {
        insertMessage.run(
          ticketId,
          message.author,
          message.body,
          message.visibility ?? "public",
          message.at,
        );
      }
      for (const event of ticket.events) {
        insertEvent.run(ticketId, event.actor, event.type, event.detail, event.at);
      }
    }

    // `ada` is seeded but unused in demo tickets; referenced to keep intent clear.
    void ada;

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
