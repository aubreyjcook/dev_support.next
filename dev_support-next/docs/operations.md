# Operations

Running, deploying, backing up and troubleshooting.

---

## 1. Requirements

- **Node.js ≥ 24** (`.nvmrc` pins `24`; `node:sqlite` exists from 22.5 / is stable
  from 24). With nvm installed: `nvm install && nvm use`.
- npm (or pnpm/yarn — the scripts are plain npm scripts).
- No database server, no build tools, no network access at build time.

Verify the runtime can open a database:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync(':memory:');console.log('ok')"
```

## 2. Local development

```bash
npm install
npm run dev                 # http://localhost:3000
npm run lint && npm run typecheck && npm test
```

The database appears at `data/helpdesk.db` on the first request. It is
gitignored. `npm run db:reset` deletes it (plus the WAL files) so the next
request re-migrates and re-seeds.

## 3. Configuration

| Variable        | Default            | Purpose                                                    |
| --------------- | ------------------ | ---------------------------------------------------------- |
| `DATABASE_PATH` | `data/helpdesk.db` | SQLite file. Absolute, or relative to the process CWD.      |
| `SEED_PASSWORD` | `helpdesk123`      | Password for the demo accounts created on first run.        |
| `SEED_DEMO`     | `true`             | `false` → no demo users, no sample tickets.                 |

Copy `.env.example` to `.env.local` for development, or export the variables in
your process manager for production. Next.js loads `.env.local`
automatically.

## 4. First production run

```bash
nvm use
npm ci
SEED_PASSWORD='<a long random string>' npm run build
SEED_PASSWORD='<a long random string>' npm start -- -p 3000
```

Checklist before real users arrive:

1. **Set `SEED_PASSWORD`** to something strong, or set `SEED_DEMO=false` and
   create your own admin afterwards (see §8 for the recovery recipe, which also
   works to bootstrap).
2. **Terminate TLS** at a reverse proxy. The session cookie is `Secure` whenever
   `NODE_ENV=production`, so the app must be served over HTTPS.
3. **Point `DATABASE_PATH` at a persistent volume** — not a container's
   ephemeral filesystem.
4. **Run a single instance.** See §9.
5. **Rate-limit `/login`** at the proxy; the app has no built-in throttling
   (`docs/authentication.md` §7).

## 5. Deployment shape

The app is a standard Next.js Node server. Any of these work:

```bash
# systemd / pm2 / supervisor
ExecStart=/usr/bin/npm start -- -p 3000
Environment=NODE_ENV=production
```

Reverse proxy (nginx sketch):

```nginx
location / {
  proxy_pass         http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header   Host $host;
  proxy_set_header   X-Forwarded-Proto $scheme;
  proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_buffering    off;   # keep responses streaming
}
```

`proxy_buffering off` matters: pages stream the static shell first and then the
session-scoped content from `/tickets`, `/`, and `/tickets/[id]`.

## 6. Data and backups

The database is a single file plus its write-ahead log:

```
data/helpdesk.db        main database
data/helpdesk.db-wal    write-ahead log
data/helpdesk.db-shm    shared-memory index
```

**Consistent backup (recommended):** stop the app, copy all three files, start
it again. If you cannot stop it, checkpoint first and then copy:

```bash
sqlite3 data/helpdesk.db "PRAGMA wal_checkpoint(TRUNCATE);"
cp data/helpdesk.db* /backups/helpdesk-$(date +%F)/
```

Restore by stopping the app, replacing the three files, and starting it again.
Migrations run on the next request, so restoring into an older app version is
safe only if that version's schema is already applied — restore the matching app
version and data together.

## 7. Reset or start over

```bash
npm run db:reset          # deletes data/helpdesk.db*
```

The next request recreates the schema, applies every migration and (unless
`SEED_DEMO=false`) seeds the demo dataset. `db:reset` refuses to run in
production without `--force`.

To keep the data but empty it, delete rows in dependency order instead:
`messages`, `events`, `tickets`, `sessions`, `users`.

## 8. Password recovery

There is no self-service reset. An admin resets a password from `Users`. If the
last admin password is lost, write a new scrypt hash directly (this matches the
storage format in `lib/password.ts`):

```bash
node -e "
const { DatabaseSync } = require('node:sqlite');
const { randomBytes, scryptSync } = require('node:crypto');
const db = new DatabaseSync('data/helpdesk.db');
const salt = randomBytes(16);
const key = scryptSync('NEW-PASSWORD-HERE', salt, 64, { N: 16384, r: 8, p: 1, maxmem: 67108864 });
const hash = ['scrypt', 16384, 8, 1, salt.toString('base64url'), key.toString('base64url')].join('\$');
const info = db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, 'ada@helpdesk.local');
console.log('rows updated:', info.changes);
"
```

Then delete that user's sessions so every device signs in again:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('data/helpdesk.db').exec('DELETE FROM sessions')"
```

## 9. Scaling and limits

This is built for **one small organization on one node**:

- SQLite with WAL comfortably handles this workload, but only from **one
  process**. Do not scale horizontally or put the file on a network share.
- Reads are synchronous. At this size that is faster than connection pooling,
  but a slow query would block the event loop — keep the dataset indexed and
  avoid unbounded scans (the list is capped at 100 rows for this reason).
- No background jobs, queues or cron requirements. Expired sessions are swept
  opportunistically on the next sign-in.
- The list view stops at 100 rows and reports the true total. If your queue
  routinely exceeds that, add pagination or a status filter to the default view.

Where to extend if the organization grows: move to Postgres behind a repository
interface (`lib/tickets.ts` is already the only module that speaks SQL), add
email notifications on message insert, and add attachment storage.

## 10. Troubleshooting

| Symptom                                              | Likely cause / fix                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Cannot find module 'node:sqlite'`                    | Node < 22.5. `nvm use` (the project pins 24).                                       |
| `SQLITE_BUSY` / "database is locked"                  | A second process is writing to the same file. Run one instance.                     |
| Every request redirects to `/login`                   | No session cookie. Check that HTTPS is terminated (the cookie is `Secure` in prod) and that the browser sends `hd_session`. |
| Signed in, but `/login` keeps appearing                | Stale cookie whose session row was deleted. Clear cookies for the site.             |
| `data/` is empty after deploy                         | `DATABASE_PATH` points elsewhere, or the volume is not mounted.                      |
| Ticket opens a "not found" panel for an agent         | The id does not exist. Agents can read every existing ticket.                        |
| A requester sees only their own tickets               | Correct — row-level scoping in `lib/tickets.ts`.                                     |
| `next build` fails on types                           | Run `npm run typecheck` for the full report; route types are generated by the build. |
| Build/prerender error about `new Date()`              | A component read the clock before a request-time API. Call `await io()` first — see `docs/architecture.md` §3. |
| Theme ignores the choice                              | `localStorage` blocked (private mode); "System" still follows the OS.                |

Server logs are the diagnostics: `next start` prints every render error with the
route and a source frame, and the error boundary shows `error.digest` in the UI
so a user's screenshot can be matched to a log line.

## 11. Upgrades

- **Next.js**: bump `next` and `eslint-config-next` together, then
  `npm run build && npm test`. Read `node_modules/next/dist/docs/01-app/02-guides/upgrading/`
  for the version you move to — this project uses version-specific APIs
  (`proxy.ts`, `io()`, `retry()`, resolved route props).
- **Node.js**: update `.nvmrc` and `package.json#engines`. Once `@types/node` is
  v22 or newer, delete `types/node-sqlite.d.ts` (it only exists because the
  project pins v20 types).
- **Database**: append to `MIGRATIONS` in `lib/db.ts`; never rewrite an applied
  migration.
