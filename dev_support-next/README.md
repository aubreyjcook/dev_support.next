# Support Desk

A minimal, fast ticket submission and tracking system for a small organization.
Requesters open tickets, agents work a shared queue, admins manage access — with
a dense UI, full dark mode, and no external services to run.

Built on **Next.js 16.4** (App Router, Turbopack) + **React 19** + **Tailwind
CSS 4**, backed by **SQLite through Node's built-in `node:sqlite`**. There are no
runtime dependencies beyond `next`, `react` and `react-dom`, no native build
step, and no database server to install.

---

## Quick start

```bash
nvm use            # .nvmrc pins Node 24; node:sqlite needs >= 22.5
npm install
npm run dev        # http://localhost:3000
```

The SQLite database is created, migrated and seeded on the first request
(`data/helpdesk.db`). Sign in with one of the seeded demo accounts:

| Email                 | Role      | Password      |
| --------------------- | --------- | ------------- |
| `ada@helpdesk.local`  | Admin     | `helpdesk123` |
| `maya@helpdesk.local` | Agent     | `helpdesk123` |
| `nina@helpdesk.local` | Requester | `helpdesk123` |

The password comes from `SEED_PASSWORD`; these accounts are advertised on the
sign-in screen in development only. Set `SEED_DEMO=false` to start with an empty
database of your own users.

## Scripts

| Command             | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Development server with hot reload                     |
| `npm run build`     | Production build (type checks + prerenders the shell)  |
| `npm start`         | Serve the production build                             |
| `npm run lint`      | ESLint (`eslint-config-next`, flat config)             |
| `npm run typecheck` | `tsc --noEmit` against the generated route types       |
| `npm test`          | Unit tests for the pure helpers (`node:test`)          |
| `npm run db:reset`  | Delete the local database; the next request re-seeds it |

## Configuration

Everything is optional; see `.env.example`.

| Variable        | Default            | Notes                                                  |
| --------------- | ------------------ | ------------------------------------------------------ |
| `DATABASE_PATH` | `data/helpdesk.db` | SQLite file location. Absolute, or relative to the CWD. |
| `SEED_PASSWORD` | `helpdesk123`      | Password for the seeded demo accounts on first run.     |
| `SEED_DEMO`     | `true`             | `false` skips demo users and sample tickets entirely.   |

## What it does

**Requesters** open tickets (subject, description, category, priority), follow
the thread, reply, and close or reopen their own tickets.

**Agents** see every ticket, search and filter the queue, claim tickets, set
status / priority / category / assignee inline, reply publicly, and add internal
notes the requester never sees.

**Admins** do all of that plus create users, change roles, deactivate accounts
and reset passwords.

The UI is deliberately small: one table, one ticket view, one admin table, a
three-way theme toggle, and no client-side data fetching. See
[`docs/workflows.md`](docs/workflows.md) for the day-to-day flows.

## Project structure

```
app/
  layout.tsx              Root shell: metadata, theme script (reads no session)
  login/                  Static sign-in screen
  (app)/                  Authenticated area
    layout.tsx            Header, nav, theme toggle, user menu
    page.tsx              Overview: stats + queues
    tickets/page.tsx      Searchable / filterable list
    tickets/new/page.tsx  Create form
    tickets/[id]/page.tsx Ticket detail: thread, properties, activity
    admin/users/page.tsx  User administration (admin only)
    error.tsx             Error boundary (retry)
    not-found.tsx         Missing or unauthorized ticket
  globals.css             Design tokens + component classes
  icon.svg                App icon
components/               Presentational and client components
lib/
  db.ts                   Connection, migrations, seed
  auth.ts                 Sessions, current user, role guards (DAL)
  users.ts                User queries
  tickets.ts              Ticket queries + transactional writes
  filters.ts              URL filter parsing (pure)
  validate.ts             Form validation accumulator (pure)
  format.ts               Date/number/string formatting (pure)
  password.ts             scrypt hashing
  actions/                Server Actions (session, tickets, users)
  constants.ts            Domain vocabulary, roles, ticket refs
proxy.ts                  Coarse session gate (Next 16 "proxy" = middleware)
types/node-sqlite.d.ts    Ambient types for node:sqlite (@types/node is v20)
tests/                    node:test suites for the pure helpers
docs/                     Architecture, data model, auth, UI, operations, flows
```

## Documentation

| Document                                           | Contents                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)     | Stack, rendering model, Cache Components, request flow, trade-offs |
| [`docs/data-model.md`](docs/data-model.md)         | Schema, migrations, seeding, query patterns                        |
| [`docs/authentication.md`](docs/authentication.md) | Sessions, hashing, role matrix, threat notes                       |
| [`docs/ui-guide.md`](docs/ui-guide.md)             | Design tokens, dark mode, component inventory, conventions         |
| [`docs/workflows.md`](docs/workflows.md)           | Ticket lifecycle and how each role uses the app                    |
| [`docs/operations.md`](docs/operations.md)         | Running, deploying, backing up, resetting, troubleshooting         |

## Key design decisions

- **No third-party runtime.** `node:sqlite` replaces an ORM/driver, scrypt from
  `node:crypto` replaces bcrypt, hand-rolled validation replaces zod. Nothing
  native to compile, nothing extra to keep patched.
- **Static shell, per-request data.** Cache Components and Partial Prerendering
  are enabled. Every page ships prerendered chrome and streams session-scoped
  data into `<Suspense>` boundaries, so a navigation shows UI immediately.
- **No client cache for ticket data.** Ticket state changes constantly and is
  per-user; the database is the cache. Mutations call `revalidatePath` and the
  pages stay dynamic rather than pretending otherwise.
- **The database enforces its own invariants.** `CHECK` constraints mirror the
  TypeScript unions, and authorization is re-applied inside every Server Action.
- **CSS-variable theming, no `dark:` variants.** One token block re-themes the
  whole app; the theme is resolved before first paint by an inline script.
- **System font stack** instead of `next/font/google`: zero network fetches at
  build time and no layout shift.

## Limitations

Out of scope on purpose, listed so nobody is surprised: no email notifications,
no attachments, no full-text index, a 100-row list cap, UTC in timestamp
tooltips, no self-service password reset, and a single-node deployment model
(one process, one SQLite file). See
[`docs/operations.md`](docs/operations.md#scaling-and-limits) for details and
where to extend.
