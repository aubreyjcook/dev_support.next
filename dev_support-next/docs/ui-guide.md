# UI guide

Design intent: **the fastest possible path to the information you need.** Small
type, high density, one primary action per screen, no decorative chrome, and a
dark theme that is a first-class citizen rather than an afterthought.

Everything visual is driven by CSS variables in `app/globals.css`. Components
never reference raw palette colors or `dark:` variants.

---

## 1. Layout

| Region            | Rule                                                              |
| ----------------- | ----------------------------------------------------------------- |
| Page container    | `mx-auto w-full max-w-6xl px-4`, vertical rhythm from `py-5`       |
| Header            | `sticky top-0` `h-14`, bottom border, translucent + `backdrop-blur` |
| Footer            | One muted line, no links                                           |
| Section spacing   | `space-y-3` inside a panel, `space-y-4` between sections            |
| Cards             | `.card` = 1px `--line` border, `0.75rem` radius, no shadow          |
| Table rows        | `py-2.5`, `border-t`, hover highlight, 13px text                    |
| Ticket detail     | Two columns from `lg`: thread `1fr` + rail `17rem`                   |

There is no sidebar and no nested navigation. The header holds the four possible
destinations (Overview, Tickets, New ticket, Users for admins) and the identity
menu; everything else is a link from a page.

## 2. Tokens

All defined twice in `app/globals.css`: once on `:root` (light) and once on
`:root[data-theme="dark"]` plus the `prefers-color-scheme` block.

| Token              | Light     | Dark      | Used for                              |
| ------------------ | --------- | --------- | ------------------------------------- |
| `--background`     | `#fafafa` | `#09090b` | Page background                       |
| `--surface`        | `#ffffff` | `#121216` | Cards, inputs, sticky header base     |
| `--surface-muted`  | `#f4f4f5` | `#1b1b21` | Hover, skeletons, inactive nav pill   |
| `--foreground`     | `#18181b` | `#ededf0` | Primary text                          |
| `--muted`          | `#6e6e78` | `#9b9ba4` | Secondary text, labels, timestamps    |
| `--muted-strong`   | `#52525b` | `#c3c3cb` | Icon buttons, tertiary actions        |
| `--line`           | `#e4e4e7` | `#26262d` | Hairline borders, table rules         |
| `--line-strong`    | `#d4d4d8` | `#3a3a44` | Input borders, dashed placeholders    |
| `--accent`         | `#2563eb` | `#60a5fa` | Primary button, focus ring, active link |
| `--accent-hover`   | `#1d4ed8` | `#93c5fd` | Primary button hover                  |
| `--accent-contrast`| `#ffffff` | `#0b1220` | Text on accent                        |
| `--danger`         | `#dc2626` | `#f87171` | Validation errors                     |

Semantic tones (`--tone-blue`, `--tone-amber`, `--tone-violet`,
`--tone-emerald`, `--tone-zinc`, `--tone-red`) each have a light and dark value
tuned for contrast on the tinted badge background.

Tokens are exposed to Tailwind through `@theme inline`, which is why
`bg-surface`, `text-muted` and `border-line` are real utilities.

### Adding a color

1. Add `--my-token` to the `:root` block **and** to both dark blocks.
2. Add `--color-my-token: var(--my-token);` to `@theme inline`.
3. Use `bg-my-token` / `text-my-token` / `border-my-token`.

Never write `#rrggbb` in a component, and never use `dark:` — if you find
yourself wanting one, the token set is missing a semantic name.

## 3. Dark mode

Three states, cycled by the button in the header: **System → Light → Dark**.

- **System** (default): no `data-theme` attribute. The
  `@media (prefers-color-scheme: dark)` block in `globals.css` supplies the dark
  tokens, so a dark-OS user gets dark mode even with JavaScript disabled.
- **Light/Dark**: the button writes `data-theme` on `<html>` immediately and
  persists the choice to `localStorage` under `helpdesk-theme`.
- **No flash**: `app/layout.tsx` inlines a render-blocking script in `<head>`
  (`THEME_INIT_SCRIPT` in `lib/theme.ts`) that applies a saved explicit choice
  before the first paint. The root layout therefore stays static — a cookie read
  there would make every route wait on the server.
- **`color-scheme`** is set per theme so native scrollbars, form controls and
  autofill match.
- The toggle reads the preference through `useSyncExternalStore`, so there is no
  `setState` in an effect, no hydration mismatch, and the icon stays in sync
  across browser tabs (`storage` events).

To style something theme-dependently, use a token. To support an image or
illustration, prefer currentColor SVGs.

## 4. Component inventory

| File                                | Kind   | Responsibility                                        |
| ----------------------------------- | ------ | ----------------------------------------------------- |
| `components/app-nav.tsx`            | client | Primary nav; active state via `usePathname`            |
| `components/user-menu.tsx`          | server | Identity, role label, sign-out form                    |
| `components/theme-toggle.tsx`       | client | Three-state theme control                              |
| `components/badges.tsx`             | server | Status / priority / category / role badges             |
| `components/time.tsx`               | server | `<time>` with relative label + UTC tooltip             |
| `components/ticket-list.tsx`        | server | Dense table + empty state                              |
| `components/ticket-filters.tsx`     | client | Search box + selects, submits via `router.replace`     |
| `components/ticket-form.tsx`        | client | Create-ticket form (`useActionState`)                  |
| `components/ticket-detail.tsx`      | server | Ticket view: header, thread, rail, requester actions   |
| `components/ticket-thread.tsx`      | server | Message list, internal-note styling                    |
| `components/ticket-properties.tsx`  | server | Inline property selects (staff)                        |
| `components/reply-form.tsx`         | client | Composer with internal-note checkbox                   |
| `components/activity-timeline.tsx`  | server | Audit trail                                            |
| `components/auto-submit-form.tsx`   | client | Form that submits itself when a `<select>` changes     |
| `components/submit-button.tsx`      | client | Submit + `useFormStatus` pending state                 |
| `components/action-button.tsx`      | client | One-shot button backed by an action                    |
| `components/assign-to-me.tsx`       | client | Claim button                                           |
| `components/dashboard.tsx`          | server | Stats, assigned queue, recent activity                 |
| `components/user-table.tsx`         | server | Admin table: role, access, reset password              |
| `components/create-user-form.tsx`   | client | Admin: add a person                                    |
| `components/reset-password-form.tsx`| client | Admin: set a password                                  |
| `components/login-form.tsx`         | client | Sign-in form                                           |

Server components are the default. `"use client"` appears only where an
interaction genuinely needs it.

## 5. Interaction patterns

**Pending feedback without extra state.** Buttons sit inside a form and read
`useFormStatus`; a wrapper sets `data-pending` so CSS can dim the affected
region. No booleans to manage.

**Filters that do not fight the URL.** `TicketFiltersForm` keeps its controls
*uncontrolled*, reading defaults from the URL. Selecting a value updates the DOM
instantly and then navigates with `router.replace(..., { scroll: false })` inside
`startTransition`. The form is remounted (via a `key` derived from the filter
signature) when the URL changes from elsewhere — that is what "Clear filters"
relies on. Without JavaScript it degrades to a plain `GET` form.

**Inline property edits.** A `<select>` in the ticket rail submits its form on
change. There is no Save button and no optimistic state; the row dims while the
action runs and the server-rendered result replaces it.

**Internal notes are CSS-driven.** The composer's "internal note" checkbox is a
real form control named `visibility`. When ticked, `.reply-composer:has(...)`
dashes the border and mutes the background — zero React state.

**Progressive enhancement.** Every form posts to its Server Action, so the app
keeps working if JavaScript fails to load. Where a `<noscript>` path is not
obvious (auto-submit selects), an "Apply" button is rendered inside `<noscript>`.

## 6. Badges

```tsx
<StatusBadge status="in_progress" />   // dot + label, tone from STATUS_TONE
<PriorityBadge priority="urgent" />    // dot + label
<CategoryBadge category="network" />   // neutral
<AwaitingDot />                        // amber dot: requester spoke last
```

Status tones: open → blue, in progress → amber, waiting → violet,
resolved → emerald, closed → zinc. Priority tones: low → zinc, normal → blue,
high → amber, urgent → red. Tones are tinted backgrounds
(`color-mix` at 11%) with a 26% ring and the tone as text color, so contrast
holds in both themes without extra classes.

## 7. Accessibility

- Every form control has a `<label>` or `aria-label`; inline errors are tied to
  inputs with `aria-describedby`, and error summaries use `role="alert"`.
- `aria-live="polite"` regions announce filter results and action outcomes.
- Focus is always visible: a 2px accent ring on links/buttons, an accent border
  plus 3px glow on inputs.
- Navigation marks the current page with `aria-current="page"`.
- Tables use `<caption class="sr-only">`, `<th scope="col">` and a `scope`d
  structure; the search form has `role="search"`.
- The theme toggle exposes the current state in its accessible name.
- `prefers-reduced-motion: reduce` collapses all transitions and the skeleton
  animation.
- Timestamps are `<time datetime="…">` with the exact UTC value in `title`, so
  the relative label ("3h ago") is an enhancement, not the only information.

## 8. Conventions and anti-patterns

**Do**

- Compose with utilities for layout, `.card` / `.btn` / `.input` / `.badge` for
  repeated surfaces.
- Keep table cells to one line; truncate long subjects (`line-clamp-2`).
- Put the primary action at the end of the row or the top right of a page.

**Don't**

- Introduce `dark:` variants — extend the tokens instead.
- Add a modal, drawer or toast for something a page or inline message can do.
- Add client-side data fetching; the server already has the data.
- Render a raw date string. Use `<Time>` so tooltips and relative labels stay
  consistent (all times are UTC; see `docs/operations.md`).
- Put an emoji or icon where a label fits; icons are for the theme toggle only.
