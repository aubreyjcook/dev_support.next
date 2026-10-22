# User guide — how to use the Support Desk

A plain, non-technical guide to the software. It assumes you already have an
account. If you don't, ask your administrator. (`docs/workflows.md` covers the
same material organized around the ticket *lifecycle*; this guide is organized
around *screens*.)

---

## 1. Signing in and the theme

1. Open the app and enter the email and password your administrator gave you.
2. Click **Sign in**.
3. The sun/moon icon in the top-right corner switches between **System → Light →
   Dark**. "System" follows your operating system; the other two are fixed. The
   choice is remembered on this browser.

## 2. The Overview screen

This is the home page. It shows:

- **Stat cards** (Open, In progress, Awaiting reply, Unassigned — or, for
  requesters, counts of *your* tickets). Each card is a link to a pre-filtered
  list.
- **"Assigned to you"** (agents) or **"Your active tickets"** (requesters) — the
  tickets most likely to need attention now.
- **"Recently updated"** — the latest activity across everything you can see.

Click any ticket subject to open it.

## 3. Creating a ticket

1. Click **New ticket** in the top navigation.
2. **Subject** — a short summary (for example "Printer on floor 2 jams").
3. **Description** — the details: what happened, what you tried, how urgent it
   is, and how to reach you. This becomes the first message of the conversation.
4. **Category** — pick the closest match.
5. **Priority** — your sense of urgency; an agent may adjust it.
6. Click **Create ticket**. You'll land on the ticket's page.

## 4. The Tickets list

This is where tickets live. From top to bottom:

- **Search box** — matches the subject or description, and also accepts a
  reference like `SUP-0007`.
- **Status / Priority / Assignee filters** — change them and the list updates.
  **Clear filters** resets everything.
- **The table** — each row shows the reference (`SUP-0007`), subject, who opened
  it, how many replies, status, priority, assignee, and when it was last updated.

An **amber dot** next to a subject means the requester spoke last — in other
words, support still owes a reply.

## 5. The ticket page

Opening a ticket shows, from top to bottom:

- **The reference and subject**, with badges for status, priority and category.
- **The conversation** — the original request followed by every reply.
- **A reply box** at the bottom of the conversation.

On the right (agents/admins) is the **Properties** panel — Status, Priority,
Assignee and Category, each changeable inline — plus **Details** (who opened it
and when) and **Activity** (a record of every change, who made it, and when).

Requesters see read-only Properties and the same Details/Activity panels.

## 6. Replying

Type in the **Write a reply…** box and click **Send reply**.

- Your reply is public: the requester and the team both see it.
- If a ticket was waiting on you, resolved, or closed, your reply **reopens it**
  automatically.

### Internal notes (agents and admins only)

Tick **Internal note** before sending to record something the requester cannot
see — a vendor case number, a cost, or a note to yourself. The box turns dashed
so you can tell at a glance that the message will be private. Internal notes do
**not** count as replying to the requester.

## 7. Working a ticket (agents)

1. **Assign to me** claims the ticket (and moves an `open` ticket to In
   progress).
2. Change **Status / Priority / Category / Assignee** in the Properties panel —
   each saves the moment you change it.
3. When you need more information, set **Status → Waiting on requester** and ask
   the question in a public reply. The ticket drops out of your queue and
   returns automatically when they answer.
4. When it's fixed, set **Status → Resolved**.

## 8. Closing and reopening (requesters)

- **Mark as resolved** closes your own ticket once it's fixed.
- **Reopen ticket** brings it back if the problem returns.
- Replying to a resolved or closed ticket also reopens it.

## 9. Administering people (admins)

Open **Users** in the top navigation.

- **Add a person** — name, email, role, and an initial password. Share the
  password with them out of band (in person or over an existing secure channel).
- **Role** — change it inline. `Requester` sees only their own tickets; `Agent`
  sees and works the whole queue; `Admin` adds user management on top.
- **Deactivate / Reactivate** — a deactivated person is signed out immediately
  and can't sign back in. Their tickets and history are untouched.
- **Reset password** (under a person's name) — sets a new password and signs
  them out of every device.

You cannot change your own role or deactivate yourself, and the last admin can
never be removed — so nobody can lock the organization out of user management.

## 10. Getting help

If something looks wrong, the page will tell you ("Ticket not found", "Email or
password is incorrect."). For an administrator troubleshooting the server, see
`docs/operations.md` — including how to recover a lost admin password.
