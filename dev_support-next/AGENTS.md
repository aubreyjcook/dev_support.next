<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project conventions (human-maintained)

This is a **Support Desk** application, not a scratchpad. Before changing code,
read `docs/architecture.md` (rendering model) and the doc matching your area.

Non-negotiables when contributing:

- **Pages stay synchronous.** `app/**/page.tsx` renders static markup and puts
  session-dependent work in a child inside `<Suspense>`. Never `await` `params`,
  `searchParams` or `cookies()` at the top of a page or layout.
- **The session read is `lib/auth.ts` only.** `getCurrentUser()` calls
  `await io()` before touching the clock or SQLite; keep that ordering. Anything
  that renders `new Date()`/`Date.now()` must sit behind it (or behind `io()`),
  otherwise `next build` and the runtime log "unstable value while prerendering".
- **Authorization is re-checked in every Server Action** via `requireUser`,
  `requireStaff` or `requireAdmin`, and row access via `getTicketDetail(id, user)`.
  Server Actions are public POST endpoints; never trust client input for identity.
- **Requesters' rows are scoped in SQL**, in `buildWhere()` in `lib/tickets.ts`.
  Do not add a query that bypasses it.
- **No `dark:` variants and no raw colors** in components — use the semantic
  tokens in `app/globals.css` (see `docs/ui-guide.md`).
- **No new runtime dependencies** without a decision recorded in
  `docs/architecture.md` §7. Pure helpers get unit tests in `tests/`.
- **Schema changes are append-only migrations** in `lib/db.ts`, mirrored by
  `CHECK` constraints and `lib/constants.ts`.

Verify with: `npm run lint && npm run typecheck && npm test && npm run build`.
