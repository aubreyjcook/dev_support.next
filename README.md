# dev_support.next

Development for a Next.js based web/user support platform with a ticketing
system and other tech-support related features.

## Purpose

A small organization needs a lightweight way to submit and track support
requests without adopting a heavyweight helpdesk product. This repository holds
that application: ticket intake, a shared agent queue, threaded conversation with
internal notes, per-ticket audit history, and admin-managed accounts — behind a
dense, minimal UI with a full dark theme.

## Layout

```
.
├─ README.md            you are here (repo-level)
├─ LICENSE
└─ dev_support-next/    the Next.js application
   ├─ app/              routes (App Router)
   ├─ components/       UI
   ├─ lib/              data layer, auth, server actions, pure helpers
   ├─ docs/             architecture, data model, auth, UI, workflows, operations
   ├─ tests/            node:test suites for the pure helpers
   └─ README.md         application guide (start here)
```

## Status

Working end to end: authentication, ticket CRUD, replies and internal notes,
inline triage (status / priority / category / assignee), requester close and
reopen, per-ticket activity history, search and filtering, admin user
management, and a flash-free three-state theme.

Verified with `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`,
and a production smoke test of every route against a seeded database
(authorization boundaries included).

## Quickstart

```bash
cd dev_support-next
nvm use          # Node 24 (.nvmrc)
npm install
npm run dev      # http://localhost:3000
```

Seeded accounts (password `helpdesk123` unless `SEED_PASSWORD` is set):

| Email                 | Role      |
| --------------------- | --------- |
| `ada@helpdesk.local`  | Admin     |
| `maya@helpdesk.local` | Agent     |
| `nina@helpdesk.local` | Requester |

## Documentation

Start with [`dev_support-next/README.md`](dev_support-next/README.md), then:

- [`docs/architecture.md`](dev_support-next/docs/architecture.md) — stack,
  rendering model, Cache Components, request flow, trade-offs
- [`docs/data-model.md`](dev_support-next/docs/data-model.md) — schema,
  migrations, seeding, query and write patterns
- [`docs/authentication.md`](dev_support-next/docs/authentication.md) — sessions,
  hashing, role matrix, threat notes
- [`docs/ui-guide.md`](dev_support-next/docs/ui-guide.md) — design tokens, dark
  mode, component inventory, conventions
- [`docs/workflows.md`](dev_support-next/docs/workflows.md) — ticket lifecycle
  and role walkthroughs
- [`docs/operations.md`](dev_support-next/docs/operations.md) — deploy, backup,
  recovery, troubleshooting

## TODOs

Done:

- [x] Next.js 16 (App Router, Turbopack, Cache Components) scaffold with TypeScript and Tailwind 4
- [x] SQLite persistence with forward-only migrations and a demo seed
- [x] Cookie sessions, scrypt password hashing, role-based access control
- [x] Ticket submission, threaded replies, internal notes
- [x] Agent triage: queue, search, filters, assignment, status/priority/category
- [x] Per-ticket activity audit trail
- [x] Admin user management (create, role, deactivate, password reset)
- [x] Minimal responsive UI with flash-free dark mode
- [x] Documentation set and unit tests

Next:

- [ ] Email notifications on new tickets and replies (SMTP or webhook)
- [ ] Attachment uploads with size/type limits
- [ ] Pagination or infinite scroll past the 100-row list cap
- [ ] Login rate limiting (or move it to the documented reverse-proxy config)
- [ ] Per-user timezone rendering instead of UTC tooltips
- [ ] CSV export of tickets and activity for reporting

## Config-Init Log

```
create-next-app   next@16.4.2, react@19.3.0, typescript, tailwindcss@4,
                  eslint-config-next, app/ router, turbopack css loader
config-edit       cacheComponents + partialPrefetching enabled (scaffold default)
config-edit       .nvmrc -> 24, engines.node >= 24 (node:sqlite)
runtime-dep-removed  next/font/google (build must not require network)
runtime-dep-removed  better-sqlite3 plan -> node:sqlite (zero native builds)
types-add         types/node-sqlite.d.ts (ambient types for node:sqlite)
entrypoint-add    proxy.ts (replaces middleware.ts in Next 16)
```
