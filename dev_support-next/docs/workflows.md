# Workflows

How tickets move, and what each role does at each step. Written so a new agent
or admin can be productive in a few minutes.

---

## 1. Ticket lifecycle

```
                     ┌──────────────────────────────────────────────┐
                     │                                              │
  requester opens ──▶ OPEN ──assign──▶ IN_PROGRESS ──reply/ask──▶ WAITING
                     │  ▲                    │                     │
                     │  │                    │ fix confirmed        │ requester
                     │  │                    ▼                     │ replies
                     │  │                 RESOLVED ────────────────┘  (auto)
                     │  │                    │
                     │  └────requester replies (auto reopen)◀── CLOSED
                     │                       │
                     └───────────────────────┘
```

| Status        | Entered by                          | Means                                        |
| ------------- | ----------------------------------- | -------------------------------------------- |
| `open`        | Creation, or automatic reopen       | Nobody is working on it yet                  |
| `in_progress` | Assigning a ticket, or manually      | An agent owns it and is working               |
| `waiting`     | An agent, after asking a question    | The ball is with the requester                |
| `resolved`    | An agent (or the requester closing)  | Fix applied, awaiting confirmation            |
| `closed`      | An agent, or the requester           | Done, no further action                       |

Agents can set any status at any time from the ticket rail. Requesters can only
**close** their own ticket ("Mark as resolved" → `closed`) and **reopen** it
(`open`).

### Automatic transitions

Two behaviours surprise people if undocumented, so they are deliberate and
logged in the ticket's Activity panel:

1. **Assigning an `open` ticket moves it to `in_progress`.** Picking up work is
   the same act as starting it. If the ticket was already `in_progress`,
   `waiting`, `resolved` or `closed`, only the assignee changes.
2. **A requester's public reply reopens a `waiting`, `resolved` or `closed`
   ticket.** If the conversation is moving, the work is moving. The event log
   records the previous status. Internal notes and agent replies never trigger
   this.

## 2. The "awaiting reply" signal

Every list and the overview use one derived flag:

> **awaiting a reply from support** = ticket is active (not resolved/closed)
> **and** the last **public** message came from the requester.

It is computed from `tickets.last_reply_by_id`, shown as a small amber dot before
the subject, and counted in the overview's "Awaiting reply" stat card. Internal
notes do not clear it — writing a private note is not answering the requester.
Posting a public reply does.

That single flag is the queue: work top-down through the tickets with the dot.

## 3. Requester walkthrough

1. **Sign in.** `npm run dev` and the credentials on the sign-in card (or the
   ones your admin gave you).
2. **Overview** shows your open work and anything recently updated.
3. **New ticket** — subject, description, category, priority. Be specific: what
   broke, what you tried, how urgent it is. The description is case 1 of the
   thread, so there is nothing else to fill in.
4. **Reply** in the ticket thread. You can always reply, including on a closed
   ticket — that reopens it.
5. **Mark as resolved** when it is fixed (this closes the ticket). **Reopen
   ticket** if the problem comes back.

Requesters never see internal notes, other people's tickets, the assignee filter,
priority changes, or the activity panel's agent-facing detail.

## 4. Agent daily loop

1. **Overview** — the four stat cards are links into pre-filtered lists:
   Open, In progress, Awaiting reply, Unassigned.
2. **Tickets** — the queue, most recently updated first. Filter by
   `Status: Active` plus `Assignee: Assigned to me` for your own work, or
   `Assignee: Unassigned` to triage. Search matches subject and description, and
   accepts a ticket reference (`SUP-0007`, `sup 7`, `7`).
3. **Open a ticket.** The rail on the right is the control panel:
   - **Assign to me** claims it (and moves it to In progress).
   - **Status / Priority / Category / Assignee** save the moment you change them.
4. **Reply** at the bottom. Use **Internal note** for context the requester
   should not see (vendor case numbers, cost, internal blame-free notes). The
   composer turns dashed when internal mode is on.
5. When you need more information, set **Status → Waiting on requester** and ask
   the question in the same reply. The ticket leaves your queue's "awaiting"
   count and comes back automatically when they answer.
6. Set **Resolved** when you believe it is fixed. If they reply again, it
   reopens on its own.

**Reading the ticket header:** reference (`SUP-0001`) → subject → status,
priority, category badges → who opened it and when. The right rail also shows
Details (requester, opened, updated, resolved) and Activity (every status,
priority, assignment and category change with its actor and time).

## 5. Admin tasks

### Add a person

`Users → Add a person`: name, email, role, initial password (8+ characters).
They can sign in immediately — share the password out of band. In-app, the
admin's own row cannot be demoted or deactivated (the controls are hidden and the
server rejects it anyway).

### Change a role

`Users` → the role `<select>` on that row. Applies on change. The last active
admin can never be demoted or deactivated.

### Deactivate / reactivate

`Deactivate` on the row. This signs them out immediately (their session rows are
deleted) and blocks new sign-ins. Reactivating restores access without touching
their data — their tickets stay assigned to them.

### Reset a password

`Users` → **Reset password** under the person's name. Sets a new password and
signs them out of every device. There is no self-service reset: an admin does it.

## 6. Worked example

> Nina's laptop will not boot at 08:40.

1. Nina opens **"Laptop will not boot after BIOS update"**, hardware, high.
   Status `open`, unassigned, **awaiting reply** (she spoke last).
2. The overview's Unassigned count goes up by one.
3. Maya opens the queue, sees the amber dot, opens the ticket, clicks **Assign to
   me** → assignee Maya, status `in_progress`, two events logged.
4. Maya asks for the error code as a public reply → still `in_progress` until she
   sets **Waiting on requester**.
5. Nina replies → the status is already `waiting`, so it is set to `open`…
   in this case Maya had set it to `waiting`, so Nina's reply reopens it to
   `open` and Maya gets it back in her "Awaiting reply" count.
6. Maya fixes it and sets **Resolved**. `resolved_at` is stamped and the ticket
   counts toward "Resolved (7d)".
7. Nina replies "thank you, it boots" → automatic reopen to `open` with an
   Activity entry. Maya sets **Closed**.

The Activity panel is the complete story of the ticket: creation, both status
changes, the assignment and every reopen.

## 7. Edge cases

| Situation                                   | Behaviour                                                        |
| ------------------------------------------- | ---------------------------------------------------------------- |
| Requester replies to a closed ticket        | Reopens to `open`; agent sees it in the awaiting-reply queue      |
| Agent replies to a `waiting` ticket         | Status stays `waiting`; only a requester reply changes it         |
| Requester opens another requester's ticket  | "Ticket not found" — the row is filtered out in SQL                |
| Requester visits `/admin/users`             | Redirected to the overview                                         |
| Deactivated user with an open session       | Session rows deleted; next request redirects to `/login`           |
| Two agents assign the same ticket           | Last write wins; both assignments appear in Activity               |
| Missing / deleted ticket id                 | Not-found panel with a link back to the queue                      |
| Session expired mid-use                     | Next page load redirects to `/login`; no data loss                 |
