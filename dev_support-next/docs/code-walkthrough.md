# Code walkthrough — a guided tour for someone learning the code

> **Who this is for:** someone who knows the fundamentals of programming — types,
> functions, HTTP, maybe a bit of React or another web framework — and wants to
> *understand this codebase*, not just run it. It explains not only **what** each
> file does but **why it is shaped that way**, in reading order.
>
> **How to use it:** read §1–§3 in order, then follow the one-request tour in
> §4 with the files open. §5–§7 are reference material you can dip into.

---

## 1. Before you start

Have the app running so you can poke at it while reading:

```bash
cd dev_support-next
nvm use && npm install && npm run dev   # http://localhost:3000
```

You will want these files open side by side:

| File | Role |
| ---- | ---- |
| `app/layout.tsx` | The very outside of the app (HTML shell) |
| `app/(app)/layout.tsx` | The authenticated chrome (header, nav) |
| `app/(app)/tickets/[id]/page.tsx` | The page we trace in §4 |
| `components/ticket-detail.tsx` | The component that actually reads a ticket |
| `lib/auth.ts` | Sessions + "who is the current user" |
| `lib/tickets.ts` | All ticket SQL and business rules |
| `lib/db.ts` | The database connection, schema, seed |

---

## 2. The five ideas that explain the whole app

If you internalize these, everything else is detail. (Each gets a fuller
treatment in §3.)

1. **Server Components are the default; Client Components are the exception.**
   In this codebase a `.tsx` file is *server-rendered* unless it starts with
   `"use client"`. Server components run once on the server and send HTML to the
   browser; they can read files, the database, and cookies. Client components run
   in the browser and own interactivity (clicks, form state). **Rule of thumb:
   the data lives on the server; the buttons live on the client.**

2. **Pages are skeletons; data streams into `<Suspense>` holes.** A page file
   (`app/.../page.tsx`) is a *synchronous* function that renders only static
   markup — headings, buttons, loading placeholders. Anything that needs the
   database or the signed-in user is wrapped in `<Suspense>`, so Next.js can send
   the shell instantly and stream the data in when it's ready.

3. **Server Actions are how the browser asks the server to change things.**
   A form's `action` is an `async function` that runs on the server. It validates
   the input, writes to the database, and either redirects or returns new state.
   Because a Server Action is just a POST endpoint, it re-checks the user and
   every input — it never trusts the browser.

4. **The "current user" comes from a cookie and is re-derived everywhere.**
   `lib/auth.ts` is the single place that reads the session cookie and turns it
   into a user. Every page and every action calls it, so identity can't be faked
   by passing a user id around.

5. **The database is one file, and the code treats it as the source of truth.**
   There is no client-side cache of tickets. Reads hit SQLite directly, and
   writes are wrapped in transactions that also append an audit event.

---

## 3. The concepts, concretely

### 3.1 Server vs. Client Components

Look at `components/ticket-list.tsx` (a **server** component):

```tsx
// no "use client" directive -> this runs on the server, never ships JS
export function TicketList({ tickets }: { tickets: TicketSummary[] }) {
  return (
    <table> ... {tickets.map(t => <tr key={t.id}>...)} ... </table>
  );
}
```

It receives data as props and returns markup. The browser receives HTML, not a
function that fetches.

Now look at `components/theme-toggle.tsx` (a **client** component):

```tsx
"use client";
export function ThemeToggle() { ... onClick={cycleTheme} ... }
```

It has an `onClick` handler and reads `localStorage` — things that only exist in
the browser — so it must be a client component.

**The key decision, every time:** could this file run without a browser? If yes,
keep it a server component (less JavaScript shipped, faster). If it needs
`useState`, `useEffect`, `usePathname`, event handlers, or browser APIs, mark it
`"use client"`.

### 3.2 Suspense and the static shell

Open `app/(app)/tickets/[id]/page.tsx`:

```tsx
export default function TicketPage({ params }: PageProps<"/tickets/[id]">) {
  return (
    <Suspense fallback={<TicketSkeleton />}>
      <TicketView params={params} />
    </Suspense>
  );
}
```

- `TicketPage` does **not** `await params`. It hands the promise down.
- `TicketView` (in `components/ticket-detail.tsx`) *does* await it, and also calls
  `requireUser()` which reads the cookie.
- `Suspense` shows `TicketSkeleton` until `TicketView` finishes.

Because the page function itself never awaits anything, Next.js can render it at
**build time** into a "static shell" (the skeleton + surrounding chrome) and
serve that instantly, then fill in the ticket when the request arrives. This is
the *entire* performance model of the app.

### 3.3 Why `io()` matters (a subtle Next.js 16 thing)

In `lib/auth.ts`:

```ts
export const getCurrentUser = cache(async () => {
  await io();                                  // <-- the important line
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  ...
  const row = get(`... WHERE s.expires_at > ?`, [new Date().toISOString()]);
```

The session query compares `expires_at` against **the current time**. With Cache
Components enabled, reading `new Date()` during a prerender pass is an error
("unstable value while prerendering"), because a value baked into the static
shell would be stale for the next visitor.

`io()` (from `next/cache`) says: "the code after this performs input/output — do
not prerender past this point." During prerendering it makes the boundary
suspend (the skeleton shows); during a real request or a Server Action it
resolves immediately. `getCurrentUser` is the one place the clock is read, so
one `io()` protects every page.

### 3.4 The Data Access Layer (DAL)

`lib/auth.ts`'s `getCurrentUser`/`requireUser`/`requireStaff`/`requireAdmin` are
the "DAL": the only code allowed to translate a request into a user. Every other
module receives a `user` or a `viewer` object and trusts it. This is what makes
the authorization story checkable: if you want to know whether an action is
protected, look at one place.

`lib/tickets.ts` plays the same role for tickets. Its reads take an explicit
`viewer` and apply row-level scoping *in the SQL*:

```ts
// lib/tickets.ts — buildWhere()
if (!isStaff(viewer.role)) {
  clauses.push("t.requester_id = ?");   // a requester can only see their own
  params.push(viewer.id);
}
```

That means a requesters can never read another requester's ticket, even if some
future page forgets to check — the query itself refuses.

### 3.5 Server Actions and progressive enhancement

`lib/actions/tickets.ts` holds the write endpoints. `addMessageAction` is the
cleanest example of the pattern every action follows:

```ts
"use server";
export async function addMessageAction(_prev, formData) {
  const user = await requireUser();               // 1. re-derive identity
  const { ticketId, body, visibility } = validate(formData); // 2. validate
  const ticket = getTicketDetail(ticketId, user); // 3. re-check row access
  if (!ticket) return failure("...");
  addMessage({ ... });                            // 4. write (transactional)
  revalidateTicketSurfaces(ticketId);             // 5. refresh cached routes
  return success("Reply posted.");
}
```

The client calls it through `useActionState` in `components/reply-form.tsx`,
which gives a `pending` flag and a `state` object back. Notice the form has
**no JavaScript required**: the HTML form posts to the action endpoint and the
same validation, guards, and redirect run — this is "progressive enhancement."

---

## 4. Follow one request through the app

Request: `GET /tickets/1` as an agent. Files are visited in this order.

**`proxy.ts`** — runs before anything else. It checks only whether a session
cookie *exists*. If not, redirect to `/login`. (It can't check validity — that
needs the database, and `proxy` is meant to stay fast and stateless.)

**`app/layout.tsx`** — the root HTML. Emits `<html>`, metadata, and an inline
`<script>` that applies a saved theme before first paint. Reads no cookies, so
it can be built once and reused.

**`app/(app)/layout.tsx`** — the authenticated shell. Renders the header with:

```tsx
<Suspense fallback={<AppNav />}>
  <NavWithSession />            // needs the role to show "Users" link
</Suspense>
```

`NavWithSession` calls `getCurrentUser()`. Because that reads a cookie, it
suspends — the fallback nav shows first, then the real nav streams in.

**`app/(app)/tickets/[id]/page.tsx`** — the page. Static: renders the
`<Suspense>` + `TicketSkeleton`. Nothing dynamic yet.

**`components/ticket-detail.tsx` → `TicketView`** — now the work happens:

```tsx
const { id } = await params;        // the URL parameter, a promise
const user = await requireUser();   // session -> user (or redirect)
const ticket = getTicketDetail(Number(id), user);   // scoped SQL read
if (!ticket) notFound();            // renders the 404 panel
const messages = listMessages(id, user);            // public-only for requesters
const events = listEvents(id);                      // audit trail
```

`requireUser` → `getCurrentUser` → `await io()` → `cookies()` → `get(...)` in
`lib/auth.ts`. The SQL joins `sessions` to `users` and rejects expired sessions.

`getTicketDetail` → `lib/tickets.ts` → `get<TicketSelectRow>(SELECT_COLUMNS +
SELECT_FROM + WHERE ...)` → `lib/db.ts` → `getDb().prepare(sql).get(...)`.

`lib/db.ts`'s `getDb()` lazily opens `data/helpdesk.db` the first time, applies
migrations, and seeds demo data if the `users` table is empty. `get()/all()/run()`
are thin wrappers over Node's `node:sqlite` prepared statements.

Finally `TicketView` returns the header, the `TicketThread`, the
`TicketProperties` rail, and the `ActivityTimeline`. Because it's inside
`<Suspense>`, all of that streams into the page the browser already has.

**The important shape to notice:** the page never `await`s, the data component
does, and the browser got useful UI before the ticket existed in memory.

---

## 5. The data layer, file by file

### `lib/db.ts` — connection, schema, migrations, seed

- `MIGRATIONS` is an array of SQL strings applied **in order**, tracked by
  `PRAGMA user_version`. Add to the *end*, never edit an old entry (existing
  databases have already run it).
- `getDb()` returns a singleton cached on `globalThis` so the dev server's hot
  reload doesn't reopen the file every edit.
- The pragmas matter: `WAL` lets readers proceed while a writer works,
  `foreign_keys` makes the FK constraints real, `busy_timeout` makes concurrent
  writers wait instead of erroring instantly.
- `seedDemoData()` runs only when `users` is empty, so you can delete
  `data/helpdesk.db` and get a fresh, realistic dataset.

### `lib/tickets.ts` — ticket queries and rules

The reads are built from three reusable parts: `SELECT_COLUMNS` (the select
list), `SELECT_FROM` (the joins), and `buildWhere(viewer, filters)` (the WHERE
clause + parameters). Building SQL from pieces is safe here because the pieces
are fixed strings and only *values* become bound parameters — never string
concatenation with user input.

The writes (`createTicket`, `addMessage`, `setTicketStatus`, …) each:

1. open a `transaction()`,
2. read the current state,
3. short-circuit if nothing changed,
4. run the `UPDATE`/`INSERT`,
5. `recordEvent(...)` so the Activity panel has a history.

Two business rules live here and only here:

- **Requester replies reopen.** `addMessage` sets the status back to `open` if a
  requester replies to a `waiting`/`resolved`/`closed` ticket.
- **Assigning claims.** `setTicketAssignee` moves an `open` ticket to
  `in_progress` when it is first assigned.

### `lib/users.ts`, `lib/auth.ts`, `lib/password.ts`

- `users.ts` is plain CRUD (no request context).
- `auth.ts` is the only file that imports `cookies()`; everything else gets a
  user object.
- `password.ts` implements scrypt hashing. The stored string is
  `scrypt$N$r$p$salt$key` — self-describing, so the cost can be raised later
  without invalidating old hashes.

### `lib/constants.ts`, `lib/filters.ts`, `lib/format.ts`, `lib/validate.ts`

These are **pure**: no database, no cookies, no React. That is a deliberate
split — pure code is trivially unit-testable (see `tests/`) and safe to import
from client components (the browser) without dragging the database along.

---

## 6. The component layer, file by file

| File | What it is | Read it to learn… |
| ---- | ---------- | ----------------- |
| `app-nav.tsx` | Nav links + active state | `usePathname` in a client component |
| `user-menu.tsx` | Identity + sign-out | rendering an async component in Suspense |
| `theme-toggle.tsx` | Light/Dark/System | `useSyncExternalStore` for non-React state |
| `badges.tsx` | Status/priority pills | presentational server components |
| `time.tsx` | Relative timestamps | a tiny reusable `<time>` |
| `ticket-list.tsx` | The queue table | mapping data to a dense table |
| `ticket-filters.tsx` | Search + filters | uncontrolled inputs + `router.replace` |
| `ticket-form.tsx` | Create-ticket form | `useActionState` + inline field errors |
| `ticket-detail.tsx` | The ticket page body | composing thread + rail + actions |
| `reply-form.tsx` | Composer + internal notes | `useActionState` + form reset |
| `ticket-properties.tsx` | Inline status/priority/… | auto-submitting selects |
| `auto-submit-form.tsx` | A form that submits on change | `useFormStatus` |
| `action-button.tsx` | A button backed by an action | reusing actions with different fields |
| `users-admin.tsx`, `user-table.tsx` | Admin user management | same patterns, admin-gated |
| `dashboard.tsx` | Overview stats + queues | aggregate queries + role-aware UI |

---

## 7. Concept glossary

| Term | Meaning here |
| ---- | ------------ |
| Server Component | `.tsx` without `"use client"`; runs on the server, returns HTML |
| Client Component | `.tsx` with `"use client"`; runs in the browser |
| Server Action | An `async` function (with `"use server"`) the browser can POST to |
| Suspense | Shows a fallback until a child finishes; enables streaming |
| Static shell | The part of a page prerendered at build time |
| Partial Prerendering | Static shell + streamed dynamic holes (enabled via Cache Components) |
| Cache Components | Next.js 16 mode where *you* mark what is dynamic |
| `io()` | Marks "I/O follows" — suspends during prerender, no-op at request time |
| `cache()` | React helper that memoizes a function per request |
| Data Access Layer | The single module that turns a request into a user (`lib/auth.ts`) |
| Migration | An append-only schema change applied in order |
| `revalidatePath` | Tells Next.js a route's cached output is stale |
| `useActionState` | React hook that binds a form to an action + returns pending/state |
| `useFormStatus` | Reads the pending state of the *enclosing* form |
| WAL | SQLite "write-ahead log": readers don't block the writer |

---

## 8. Try it yourself

These exercises map to specific parts of the code; they're the fastest way to
confirm you understand it.

1. **Add a field to a ticket.** Follow `docs/architecture.md` §6. You will touch
   `db.ts`, `constants.ts`, `tickets.ts`, `ticket-properties.tsx`, and an action
   case — the whole data path in miniature.
2. **Explain why the reply form is a client component but `TicketList` is not.**
   Find the browser-only API each depends on.
3. **Make `listTickets` return 25 rows instead of 100** and find where the UI
   tells the user the list was truncated.
4. **Trace what happens to a closed ticket when its requester replies**, using
   only `lib/tickets.ts` (`addMessage`) — identify the exact `if` and the event it
   logs.
5. **Break a migration on purpose** (temporarily) and watch the error surface on
   the next request, then undo it. This teaches the failure mode of
   `PRAGMA user_version`.

---

## 9. If you get lost

- `docs/architecture.md` — the same content organized as a *design* document.
- `docs/data-model.md` — the schema and every table, column by column.
- `docs/ui-guide.md` — how the visual layer and theming work.
- `docs/workflows.md` — what users *do* (the product behavior).
- `docs/operations.md` — running, deploying, backups.
- `AGENTS.md` — the non-negotiable conventions a contributor must follow.
