# Roadmap

Suggested next steps, in rough priority order. This is guidance, not a
commitment — revisit it before starting anything here, and strike a line when
something ships. Items are grouped by *why*, not by size.

---

## Now — harden what exists

- **Login rate limiting.** The app has no brute-force protection (noted in
  `docs/authentication.md` §7). Add a per-IP counter (`sessions` table or the
  reverse proxy) with a backoff, or document the proxy recipe prominently.
- **Integration tests for the data layer.** Unit tests cover the pure helpers;
  the SQL is only exercised manually. Add a `node:test` suite that opens a
  temporary SQLite file and asserts the query/write rules (scoping, auto-reopen,
  claiming, migrations idempotency).
- **A "who am I / where am I" debug affordance.** Nothing major, but the error
  boundary currently shows a digest; add a friendly, non-technical recovery path
  ("this page failed to load, nothing was changed") — it exists, verify it reads
  well in production.

## Short term — round out the product

- **Email notifications.** On ticket creation and on reply, notify the other
  party (SMTP or a webhook). This is the single most-requested feature for a
  support desk. Model: a `notifications` queue table written in the same
  transaction as the message; a small sender script drains it.
- **Attachments.** Allow one or more files per message with size/type limits.
  Store on disk (or S3), reference in a new `attachments` table; stream through a
  Route Handler that re-checks ticket access.
- **Pagination / load more** past the current 100-row cap (and make the cap
  configurable). Simplest: keyset pagination on `updated_at, id`.
- **Per-user timezone.** Timestamps are UTC by design (`docs/ui-guide.md` §7).
  Add a `timezone` column to `users` and format `<Time>` accordingly, or ship a
  client-side `<LocalTime>` using the documented inline-script pattern.
- **CSV export** of tickets + activity for reporting (admin only).

## Medium term — deepen the tool

- **Full-text search.** Move search from `LIKE` to SQLite FTS5 (or Postgres, if
  the migration in `docs/architecture.md` happens) with subject+description
  ranking and highlighted matches.
- **Saved views / macros.** Let an agent save a filter ("my open urgent queue")
  and pin it to the overview.
- **SLA reminders.** Compute "awaiting reply for N hours" and surface stale
  tickets in the overview (the data is already derivable from
  `last_reply_by_id` + `updated_at`).
- **Audit export and sign-in log.** Add sign-in events to the `events`-style
  table so administrators can answer "who logged in when".
- **Keyboard shortcuts.** `g t` → tickets, `g n` → new ticket, `/` → search.
  Cheap to add, big quality-of-life win for agents.

## Longer term — structural

- **PostgreSQL behind the repository layer.** Only if a trigger from
  `docs/architecture.md` §7 fires (multiple instances, heavy concurrency,
  compliance). The port is scoped and cheap *because* the driver is already
  isolated to `lib/db.ts`; keep it that way.
- **Self-service password reset** via an emailed, single-use token (replaces the
  admin-only flow and the recovery recipe in `docs/operations.md` §8).
- **Multi-tenant / departments.** If several teams want isolation, a `teams`
  table plus per-ticket team scoping — revisit the authorization matrix in
  `docs/authentication.md` §4 first.
- **i18n.** If the org is not English-only, extract strings and date formats;
  the token-based theming already demonstrates the "no hard-coded locale" habit.

## Explicitly out of scope (for now)

Listed so effort isn't wasted: real-time chat, a public customer portal,
mobile apps, and any feature that requires a background worker infrastructure
rather than the in-request transaction pattern.

---

## How to use this file

- Before starting a piece of work, read the related doc in `docs/` — most items
  name it.
- Update this file in the same change that ships an item: check it off, add the
  new "now" items you discovered along the way.
- The agent instructions ask for a roadmap *with each update* — keep this list
  current even when a change is only a bug fix.
