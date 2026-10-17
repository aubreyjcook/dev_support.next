# Authentication and authorization

Cookie sessions, server-side, revocable. No third-party auth library: the whole
mechanism is `lib/auth.ts` (~120 lines) plus two tables.

---

## 1. Model at a glance

```
POST /login (Server Action)
  email + password
      │
      ├─ findUserByEmail()          (case-insensitive, unique)
      ├─ verifyPassword()           scrypt, timing-safe compare
      │
      └─ startSession(userId)
            token = 32 random bytes (base64url)
            DB: INSERT sessions (token_hash = SHA-256(token), expires_at = +7d)
            Set-Cookie: hd_session=<token>; HttpOnly; SameSite=Lax; Path=/; [Secure]
```

The cookie carries the raw token; the database stores only its SHA-256 hash. A
database leak therefore cannot be replayed as a session.

## 2. The cookie

| Attribute  | Value                                  | Reason                                            |
| ---------- | -------------------------------------- | ------------------------------------------------- |
| Name       | `hd_session`                           | Defined once in `lib/constants.ts` (`SESSION_COOKIE`) so `proxy.ts` can import it without pulling in the DB |
| `HttpOnly` | yes                                    | Not readable from JavaScript (limits XSS impact)  |
| `SameSite` | `Lax`                                  | Blocks cross-site POSTs; keeps normal navigation  |
| `Secure`   | yes when `NODE_ENV === "production"`   | Requires HTTPS in production (see §7)             |
| `Path`     | `/`                                    |                                                   |
| `Expires`  | now + 7 days                           | Matches `sessions.expires_at`                     |

## 3. Passwords

`lib/password.ts`, storage format:

```
scrypt$<N>$<r>$<p>$<salt-base64url>$<key-base64url>
```

- `N = 16384`, `r = 8`, `p = 1`, 64-byte key, 16-byte random salt.
- Parameters travel with the hash, so they can be raised later without
  invalidating existing passwords (old hashes keep verifying).
- `timingSafeEqual` prevents comparison timing leaks.
- Minimum length 8 (enforced in the action *and* the form). No composition rules:
  length beats character classes and avoids annoying an internal user base.
- A password change deletes that user's sessions (`lib/users.ts →
  updateUserPassword`), i.e. every device is signed out.

**Unknown-account timing.** When the email does not exist, `signIn` still runs
one scrypt hash before returning the generic error, so "no such user" and "wrong
password" take comparable time.

## 4. Roles and permissions

| Action                                   | Requester | Agent | Admin |
| ---------------------------------------- | :-------: | :---: | :---: |
| Create a ticket                          | ✓         | ✓     | ✓     |
| See **own** tickets                      | ✓         | ✓     | ✓     |
| See **all** tickets                      |           | ✓     | ✓     |
| Reply publicly                           | ✓ (own)   | ✓     | ✓     |
| Add internal notes                       |           | ✓     | ✓     |
| Change status / priority / category      |           | ✓     | ✓     |
| Assign / claim tickets                   |           | ✓     | ✓     |
| Close or reopen own ticket               | ✓ (own)   | ✓     | ✓     |
| Manage users (create, role, deactivate)  |           |       | ✓     |
| Reset another user's password            |           |       | ✓     |

Role helpers live in `lib/constants.ts` (`isStaff`, `canManageUsers`).

## 5. Enforcement is layered

Authorization is checked four times, on purpose. Any single layer can be wrong
without granting access.

| # | Where                            | What it checks                                  | Kind of check       |
| - | -------------------------------- | ----------------------------------------------- | ------------------- |
| 1 | `proxy.ts`                       | Is a session cookie present?                    | Coarse redirect     |
| 2 | Page/layout components           | `requireUser` / `requireStaff` / `requireAdmin` | Redirect or 404     |
| 3 | `lib/tickets.ts` queries         | `requester_id = viewer.id` for non-staff        | Row-level scoping   |
| 4 | `lib/actions/*.ts`               | Re-derive the user, re-check the row, validate  | Authoritative write |

Layer 3 is the important one: `getTicketDetail(id, viewer)` applies the scope in
SQL, so requesters cannot read a ticket they do not own even if a page forgets a
check. Layer 4 exists because **Server Actions are ordinary POST endpoints** —
anyone can call them directly, so every action re-authenticates and re-validates
before writing.

`getCurrentUser()` is wrapped in React's `cache()`, so the multiple checks in one
render (nav, menu, page, action) cost exactly one database query per request.

## 6. Session lifecycle

| Event                        | Effect                                                |
| ---------------------------- | ----------------------------------------------------- |
| Sign in                      | New random token; a new row (no fixation of an old id) |
| Sign out                     | Row deleted, cookie cleared                            |
| Password changed/reset       | All rows for that user deleted                         |
| User deactivated             | `is_active = 0` + all rows deleted                     |
| Expired                      | Rejected by the `expires_at > now` predicate; swept on the next sign-in |
| Rejected by validation       | `getCurrentUser()` returns `null` → redirect to `/login` |

There is no sliding expiration: a session lasts 7 days from sign-in, then the
user signs in again. That is a deliberate simplification for an internal tool.

## 7. Threat notes

**SQL injection.** Every query uses prepared statements with bound parameters.
The one dynamic fragment (`WHERE …`) is assembled from a fixed set of clauses;
user input only ever becomes a parameter value. Filters are validated against
allow-lists (`parseTicketFilters`) before reaching SQL.

**XSS.** React escapes all interpolated text. The only
`dangerouslySetInnerHTML` in the codebase is the static theme script in
`app/layout.tsx`, which contains no user input. Message bodies are rendered as
text (`white-space: pre-wrap`), never as HTML.

**CSRF.** Mutations are Server Actions invoked via `POST` with framework-generated
action identifiers, and the session cookie is `SameSite=Lax`, so a cross-site
form cannot carry it. There are no `GET` endpoints that mutate state.

**Session hijacking.** Cookie is `HttpOnly` + `Secure` in production. Serving
over plain HTTP in production would strip `Secure` from the cookie attribute —
terminate TLS at a reverse proxy (`docs/operations.md`).

**Brute force.** *Not* rate limited in the application. scrypt makes each attempt
expensive (~50 ms), which slows but does not stop a determined attacker. Put a
per-IP limit at the reverse proxy, or add an attempt counter to the `sessions`
table if you need it in-app.

**Enumeration.** Unknown emails and wrong passwords return the identical message
("Email or password is incorrect.") and comparable timing.

**Seeded accounts.** Demo users exist only when the database is empty and
`SEED_DEMO !== "false"`. Their password is `SEED_PASSWORD` (default
`helpdesk123`) — set it to something strong or set `SEED_DEMO=false` before the
first production run. The sign-in page only advertises them when
`NODE_ENV !== "production"`.

## 8. Not implemented

Stated plainly so the scope is clear: no MFA, no email verification, no
self-service password reset (an admin resets it), no login rate limiting, no
session listing/revocation UI, no audit log of sign-ins. Each is straightforward
to add on top of the `sessions` table.
