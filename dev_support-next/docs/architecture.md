# Architecture

How the application is put together, why it is put together that way, and where
to make changes.

---

## 1. Stack

| Layer      | Choice                                                | Why                                                                 |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Framework  | Next.js 16.4.2, App Router, Turbopack                 | Server Components keep almost all code off the client.               |
| UI runtime | React 19.3                                            | `useActionState`, Server Actions, Suspense.                          |
| Styling    | Tailwind CSS 4 via `@tailwindcss/turbopack`            | CSS-first config; no PostCSS setup, no runtime CSS-in-JS.            |
| Database   | `node:sqlite` (`DatabaseSync`)                        | Zero-dependency, synchronous, no native build step.                  |
| Auth crypto| `node:crypto` scrypt + SHA-256                        | No bcrypt/argon2 native module needed.                               |
| Validation | `lib/validate.ts`                                     | ~150 lines beats a schema library for six forms.                     |
| Tests      | `node:test`                                           | Built in; runs TypeScript directly via Node's type stripping.        |

`package.json` therefore has exactly three runtime dependencies: `next`,
`react`, `react-dom`.

### Next.js 16 specifics that matter here

This project uses features that differ from older Next.js versions. If you are
adding code, these are the ones that will bite:

- **`proxy.ts` replaces `middleware.ts`.** Same role, new filename and export
  name (`export function proxy`).
- **Route props are promises.** `params` and `searchParams` are typed through the
  generated `PageProps<"/route">` / `LayoutProps<"/">` helpers and must be
  awaited (or pushed down into a child).
- **Cache Components is enabled** (`cacheComponents: true`), together with
  `partialPrefetching: true`. Prerendering rules in §3 below are a consequence.
- **`cookies()` is async**, and setting cookies is only allowed in Server
  Actions and Route Handlers.
- **Error boundaries receive `retry()`** (the earlier `reset()` is deprecated).
- **`refresh()` exists** in `next/cache` for router refreshes after a mutation.

## 2. Request flow

```
Browser
  │
  ├─ proxy.ts ──────────── no session cookie? → 307 /login
  │                        (cookie presence only; never touches the database)
  │
  ├─ app/layout.tsx ────── static HTML shell: <html>, metadata, inline theme script
  │
  ├─ app/(app)/layout.tsx  static chrome: brand, nav fallback, theme toggle
  │     ├─ <Suspense> NavWithSession   ← streams after session resolves
  │     └─ <Suspense> UserMenu        ← streams after session resolves
  │
  └─ app/(app)/<page> ──── static page shell (headings, buttons, skeletons)
        └─ <Suspense> data component
              │
              ├─ requireUser()/requireStaff()  → lib/auth.ts (DAL)
              │     └─ io() → cookies() → sessions JOIN users
              └─ lib/tickets.ts                → lib/db.ts → SQLite
```

Every page component is a **synchronous function** that renders its own static
header and wraps the data-dependent part in `<Suspense>`. That is the whole
trick: nothing in a page or layout `await`s above a Suspense boundary, so the
prerendered shell contains real chrome instead of a blank screen.

### Layers and their rules

| Layer                | May do                                          | Must not do                                     |
| -------------------- | ----------------------------------------------- | ----------------------------------------------- |
| `app/**/page.tsx`    | Render static markup, pass promises down        | `await` params/searchParams/cookies directly     |
| `components/*-view`  | `await` everything, call the DAL, query the DB  | Decide authorization on its own                  |
| `lib/*.ts`           | Query the DB, enforce row scoping               | Read `cookies()` (except `lib/auth.ts`)          |
| `lib/actions/*.ts`   | Validate input, re-derive the user, write, revalidate | Trust any client-supplied identity        |

## 3. Rendering model (Cache Components)

`cacheComponents: true` changes the contract: dynamic APIs are allowed, but they
must be *inside* a Suspense boundary, and the clock (`new Date()`, `Date.now()`)
counts as dynamic input.

Three things make this app comply without giving up the static shell:

1. **The session read is the suspension point.** `getCurrentUser()` calls
   `await io()` and then `cookies()`, then queries the session. Any component
   that needs a user suspends there, and Next renders the boundary's fallback
   into the shell.

   `io()` (from `next/cache`, new in 16.3) is required because the session
   lookup compares `expires_at` against the current time. Without it, the
   prerender pass reaches `new Date()` and fails with *"encountered the unstable
   value `new Date()` while prerendering"*. `io()` hangs only while
   prerendering; in a real request, a Server Action, or the browser it resolves
   immediately (see `next/dist/server/request/io.js`).

2. **Session-dependent chrome is isolated.** The navigation needs the role only
   to decide whether to show the "Users" link. That component lives in its own
   boundary with the session-free nav as its fallback, so the header keeps its
   active states while the admin item pops in a moment later.

3. **Pages opt out of instant-navigation validation.** `app/(app)/layout.tsx`
   exports `instant = false`: everything below requires a session, so navigation
   into these routes legitimately waits for the server. The login route is not
   opted out and stays a fully static page.

Resulting build output:

```
○  /login, /_not-found, /icon.svg            fully static
◐  /, /tickets, /tickets/[id], /tickets/new, /admin/users   static shell + streamed
ƒ  Proxy (Middleware)
```

### Why the ticket data is *not* cached

`use cache` would be the wrong tool here. Ticket data is per-user, changes on
every reply/status change, and is cheap to read from a local SQLite file. Caching
it would mean maintaining cache tags for every mutation to avoid showing stale
queues. Instead the pages stay dynamic and mutations call `revalidatePath`:

```ts
// lib/actions/tickets.ts
revalidatePath("/");
revalidatePath("/tickets");
revalidatePath(`/tickets/${ticketId}`);
revalidatePath("/tickets/[id]", "page");
```

Server Actions already return a re-rendered tree for the current route, which is
what makes the reply form feel instant.

### Consequences worth knowing

- **A redirect inside a boundary cannot change the status code.** If a cookie
  exists but the session is invalid, the shell has already been flushed as `200`
  by the time `requireUser()` redirects; the browser is then sent to `/login`
  by the streamed response. `proxy.ts` therefore only checks for cookie
  *presence* — checking validity there would risk a `/` ⇄ `/login` loop with a
  stale cookie.
- **`notFound()` streams too.** Opening a ticket that is not yours renders the
  not-found boundary with a `200`. Access is still denied; only the status code
  is less declarative. Do not depend on the status code for access control.
- **Page metadata is static** (`title: "Ticket"`). Awaiting `params` inside
  `generateMetadata` would block the shell for every route.

## 4. Mutations

All writes are Server Actions in `lib/actions/`, imported by client forms.

```
form action={formAction}
  → validate (lib/validate.ts)
  → re-derive the user (requireUser / requireStaff / requireAdmin)
  → re-check row access (getTicketDetail(id, user))
  → write inside a transaction (lib/tickets.ts)
  → append an audit event
  → revalidatePath(...)
  → return { status, message, stamp }        (or redirect())
```

Every form is progressively enhanced: without JavaScript the browser posts to
the action endpoint, and the same validation, guards and redirect run. This was
verified against the production build: the login form renders the
`$ACTION_*` hidden fields and `enctype="multipart/form-data"` expected by React.

Pending state comes from three places, each chosen to avoid extra state:

| Interaction                | Pending source                                |
| -------------------------- | --------------------------------------------- |
| Any button inside a form   | `useFormStatus` (`components/submit-button`)   |
| Reply / create / login     | `useActionState`'s `pending`                  |
| Filter navigation          | `useTransition` + `router.replace`            |

## 5. Directory conventions

- `app/(app)/…` — anything requiring a session. The route group keeps `/login`
  outside the authenticated chrome.
- `components/{name}-{role}.tsx` — `ticket-form` (client form),
  `ticket-list` (server presentational), `ticket-detail` (server data view).
- `lib/*.ts` — no React. The only exception is `lib/auth.ts`, which imports
  `cookies()` and React's `cache()` because it is the Data Access Layer.
- Pure modules (`constants`, `filters`, `format`, `validate`) have no
  environment-specific imports, which is why they are unit-testable and safe to
  import from client components.

## 6. Extending

**Add a ticket field**

1. `lib/db.ts` — append a new entry to `MIGRATIONS` (never edit an existing one)
   with the column and a `CHECK` constraint.
2. `lib/constants.ts` — add the value/label/tone; mirror the constraint.
3. `lib/tickets.ts` — include it in `SELECT_COLUMNS`, `toSummary`/`toDetail`,
   and add a setter that records an event.
4. `components/ticket-properties.tsx` — add a row with an `AutoSubmitForm`.
5. `lib/actions/tickets.ts` — add a `case` to `setTicketFieldAction`.

**Add a page**

Create `app/(app)/<route>/page.tsx` as a synchronous shell and put the session
read in a child inside `<Suspense>`. Copy the structure of
`app/(app)/tickets/page.tsx`.

**Add a role** — `lib/constants.ts` (`ROLES`, `ROLE_LABEL`, `ROLE_TONE`), the
`users` table `CHECK` constraint (new migration), and the guards in `lib/auth.ts`.

## 7. Trade-offs recorded

| Decision                                            | Alternative considered            | Why this way                                                        |
| --------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| Synchronous SQLite access                           | `better-sqlite3`, Prisma, Drizzle | No native build, no codegen; reads are sub-millisecond at this scale |
| `io()` + `cookies()` instead of `connection()`      | `connection()`                    | `io()` still allows prefetching; `connection()` blocks it            |
| No `use cache` for tickets                          | Tag-based caching                 | Correctness over cache plumbing for a queue that changes constantly |
| Cookie presence check in `proxy.ts`                 | Session validation in the proxy   | The proxy cannot read SQLite; a stale cookie would loop             |
| Theme in `localStorage` + inline script             | Theme cookie + dynamic root layout| Keeps the root layout static (a cookie read there would block everything) |
| `types/node-sqlite.d.ts`                            | Bump `@types/node` to 22+         | Avoids a lockfile change; delete the file once `@types/node` moves   |
