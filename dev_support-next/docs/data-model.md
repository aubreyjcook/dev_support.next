# Data model

One SQLite file, five tables, no ORM. Everything lives in `lib/db.ts` (schema,
migrations, connection) and `lib/tickets.ts` / `lib/users.ts` (queries).

---

## 1. Entity overview

```
users ──┬──< sessions            (a session belongs to one user)
        │
        ├──< tickets.requester_id    (who opened it)
        ├──< tickets.assignee_id     (who is working it, nullable)
        ├──< tickets.last_reply_by_id (who spoke last, nullable)
        ├──< messages.author_id
        └──< events.actor_id         (nullable: system actions)

tickets ──┬──< messages          (the conversation)
          └──< events            (the audit trail)
```

`users` is both an identity table and the actor table: requester, assignee and
message author all point at the same row.

## 2. Tables

### `users`

| Column          | Type    | Notes                                                |
| --------------- | ------- | ---------------------------------------------------- |
| `id`            | INTEGER | PK                                                   |
| `email`         | TEXT    | `UNIQUE COLLATE NOCASE` — sign-in handle             |
| `name`          | TEXT    | Display name, also shown in the assignee picker      |
| `role`          | TEXT    | `requester` \| `agent` \| `admin` (CHECK)             |
| `password_hash` | TEXT    | `scrypt$N$r$p$salt$key`, see `lib/password.ts`        |
| `is_active`     | INTEGER | `0`/`1` (CHECK). Deactivated users cannot sign in    |
| `created_at`    | TEXT    | ISO-8601 UTC                                          |

Deactivating a user deletes their sessions in the same operation
(`lib/users.ts → setUserActive`).

### `sessions`

| Column       | Type | Notes                                          |
| ------------ | ---- | ---------------------------------------------- |
| `token_hash` | TEXT | PK — SHA-256 of the cookie value (never raw)   |
| `user_id`    | INT  | FK → `users.id`, `ON DELETE CASCADE`           |
| `created_at` | TEXT | ISO-8601 UTC                                   |
| `expires_at` | TEXT | ISO-8601 UTC; 7 days after creation            |

Expired rows are swept opportunistically whenever a new session is created.

### `tickets`

| Column             | Type    | Notes                                                        |
| ------------------ | ------- | ------------------------------------------------------------ |
| `id`               | INTEGER | PK; drives the public reference `SUP-0001`                    |
| `subject`          | TEXT    | 3–120 chars (validated in the action)                         |
| `description`      | TEXT    | 10–8000 chars; the first "message" of the thread              |
| `status`           | TEXT    | `open` \| `in_progress` \| `waiting` \| `resolved` \| `closed` |
| `priority`         | TEXT    | `low` \| `normal` \| `high` \| `urgent`                        |
| `category`         | TEXT    | `hardware` \| `software` \| `network` \| `accounts` \| `printing` \| `other` |
| `requester_id`     | INT     | FK → `users.id`, `ON DELETE RESTRICT`                         |
| `assignee_id`      | INT     | FK → `users.id`, nullable, `ON DELETE SET NULL`               |
| `last_reply_by_id` | INT     | Nullable; the author of the most recent **public** message    |
| `created_at`       | TEXT    | ISO-8601 UTC                                                  |
| `updated_at`       | TEXT    | ISO-8601 UTC; bumps on any message or property change         |
| `resolved_at`      | TEXT    | Set when entering `resolved`, cleared when leaving to an active status |

Indexes: `status`, `assignee_id`, `requester_id`, and `updated_at DESC` (the
default list ordering).

**Status semantics**

| Status        | Meaning                                                   |
| ------------- | --------------------------------------------------------- |
| `open`        | New, nobody has picked it up yet                          |
| `in_progress` | An agent is working on it (assigned tickets move here)    |
| `waiting`     | Blocked on the requester for information or confirmation  |
| `resolved`    | Fix believed applied; requester can confirm               |
| `closed`      | Done, no further action expected                          |

Anything in `open`/`in_progress`/`waiting` is "active" work
(`ACTIVE_STATUSES` in `lib/constants.ts`).

**`last_reply_by_id` is the queue signal.** A ticket is *awaiting a reply from
support* when it is active and the requester spoke last:

```sql
last_reply_by_id = requester_id AND status IN ('open','in_progress','waiting')
```

Internal notes deliberately do **not** update this column — writing a private
note is not answering the requester.

### `messages`

| Column       | Type | Notes                                        |
| ------------ | ---- | -------------------------------------------- |
| `id`         | INT  | PK                                           |
| `ticket_id`  | INT  | FK → `tickets.id`, `ON DELETE CASCADE`       |
| `author_id`  | INT  | FK → `users.id`, `ON DELETE CASCADE`         |
| `body`       | TEXT | 2–8000 chars (validated)                     |
| `visibility` | TEXT | `public` \| `internal` (CHECK)               |
| `created_at` | TEXT | ISO-8601 UTC                                 |

The original ticket description is stored on `tickets`, not duplicated here; the
thread view renders it as the first entry.

`internal` messages are filtered out in SQL for non-staff viewers:

```sql
WHERE m.ticket_id = ? AND (m.visibility = 'public' OR ? = 1)
```

### `events`

| Column       | Type | Notes                                              |
| ------------ | ---- | -------------------------------------------------- |
| `id`         | INT  | PK                                                 |
| `ticket_id`  | INT  | FK → `tickets.id`, `ON DELETE CASCADE`             |
| `actor_id`   | INT  | Nullable; `ON DELETE SET NULL`                     |
| `type`       | TEXT | `created` \| `status` \| `priority` \| `assignee` \| `category` |
| `detail`     | TEXT | Human phrase appended after the actor's name        |
| `created_at` | TEXT | ISO-8601 UTC                                       |

`detail` is stored as a ready-to-render phrase, e.g.
`changed status from Open to In progress`. The UI renders
`{actorName} {detail}` with no formatting logic.

## 3. Migrations

Forward-only, tracked with `PRAGMA user_version`:

```ts
// lib/db.ts
const MIGRATIONS: readonly string[] = [ /* 1 -> initial schema */ `...` ];
```

On open, any migration with an index above the stored `user_version` runs inside
its own transaction and bumps the version. Rules:

- **Never edit a shipped migration** — existing databases already recorded it.
- **Append only.** Add index 2, 3, … Each runs exactly once per database.
- Keep `CHECK` constraints in sync with `lib/constants.ts`.

To change the schema locally, append a migration and restart; no reset needed.
To start over, `npm run db:reset` (deletes the file; the next request recreates
and seeds it).

## 4. Seeding

`seedDemoData()` runs once, when `users` is empty and `SEED_DEMO !== "false"`.
It inserts five users (one admin, two agents, two requesters), six tickets
covering every status, seven messages (including one internal note) and fifteen
audit events. Timestamps are relative to `Date.now()`, so relative labels like
"3h ago" look sensible on a fresh database.

`SEED_PASSWORD` (default `helpdesk123`) is hashed once and reused for all demo
accounts. For a real deployment set a strong value or disable seeding.

## 5. Connection handling

```ts
export function getDb(): DatabaseSync   // cached on globalThis, survives HMR
```

- Path: `DATABASE_PATH` or `<cwd>/data/helpdesk.db`. The parent directory is
  created if missing.
- Pragmas: `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`.
- The connection is created lazily on first query, so importing `lib/db.ts`
  (directly or through an action module) does not touch the disk during a build.

`getDb()` returns the path verbatim rather than joining it with `process.cwd()`
when `DATABASE_PATH` is set: Turbopack's static analysis flags a
`resolve(process.cwd(), <dynamic>)` call as "dynamic filesystem access" and would
otherwise trace the entire project into the server bundle.

## 6. Query patterns

All queries live in `lib/tickets.ts` and are built from three pieces:

```ts
const SELECT_COLUMNS = `... t.id, ..., (SELECT COUNT(*) FROM messages m WHERE m.ticket_id = t.id) AS message_count`;
const SELECT_FROM    = `FROM tickets t JOIN users ru ... LEFT JOIN users au ... LEFT JOIN users lr ...`;
buildWhere(viewer, filters)  // → { sql: "WHERE ... AND ...", params: [...] }
```

`buildWhere` always starts with the row-level scope:

```ts
if (!isStaff(viewer.role)) {
  clauses.push("t.requester_id = ?");
  params.push(viewer.id);
}
```

so a forgotten check in a page cannot leak another requester's data.

Search is a `LIKE` on subject and description with wildcards escaped
(`ESCAPE '\'`), plus an exact id match when the query parses as a ticket
reference (`SUP-7`, `sup 7`, `7`) via `parseTicketRef`.

Lists are capped at 100 rows and report `total` separately, so the UI can say
"showing the first 100". Both the page query and the count query reuse the same
`WHERE` string and parameter array.

## 7. Writes

Every mutation runs inside `transaction()` (`BEGIN` / `COMMIT` / `ROLLBACK`) and
records an event:

```ts
setTicketStatus(ticketId, status, actor)
  → read current state
  → no-op if unchanged
  → UPDATE tickets SET status, resolved_at, updated_at
  → INSERT INTO events (...)
```

`addMessage` has two side effects worth knowing:

1. A **public** message sets `last_reply_by_id`.
2. A public reply **from the requester** on a `waiting` / `resolved` / `closed`
   ticket reopens it (`status = 'open'`, `resolved_at = NULL`) and logs an event
   with the previous status.

`setTicketAssignee` also moves an `open` ticket to `in_progress` when it is
assigned for the first time ("claiming"), logging both events.

## 8. Data integrity

Beyond the `CHECK` constraints and foreign keys:

- Emails are normalized (`trim().toLowerCase()`) before insert and lookup.
- Validated lengths match the action-level rules in `lib/validate.ts`; the
  database is the second line of defence, not the first.
- Timestamps are always ISO-8601 UTC strings, so lexicographic ordering equals
  chronological ordering — which is why `ORDER BY updated_at DESC` works and why
  `expires_at > ?` can be a plain string comparison.
