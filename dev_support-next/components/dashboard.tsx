import Link from "next/link";

import { AwaitingDot, StatusBadge } from "@/components/badges";
import { Time } from "@/components/time";
import { requireUser } from "@/lib/auth";
import { isStaff } from "@/lib/constants";
import { DEFAULT_FILTERS, type TicketFilters } from "@/lib/filters";
import { getStats, listTickets, type TicketSummary } from "@/lib/tickets";

interface Stat {
  label: string;
  value: number;
  href: string;
  emphasis?: boolean;
}

function StatCard({ stat }: { stat: Stat }) {
  return (
    <Link
      href={stat.href}
      className="card px-3 py-2.5 transition-colors hover:bg-surface-muted"
    >
      <div className="text-[11px] text-muted">{stat.label}</div>
      <div
        className={[
          "mt-0.5 text-xl font-semibold tabular-nums",
          stat.emphasis && stat.value > 0 ? "text-danger" : "",
        ].join(" ")}
      >
        {stat.value}
      </div>
    </Link>
  );
}

function CompactRow({ ticket }: { ticket: TicketSummary }) {
  return (
    <li>
      <div className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-surface-muted/70">
        <span className="w-3 shrink-0">
          {ticket.awaitingAgent ? <AwaitingDot /> : null}
        </span>
        <Link
          href={`/tickets/${ticket.id}`}
          className="min-w-0 flex-1 truncate text-[13px] font-medium hover:text-accent"
          title={ticket.subject}
        >
          {ticket.subject}
        </Link>
        <StatusBadge status={ticket.status} short />
        <Time
          value={ticket.updatedAt}
          className="w-14 shrink-0 text-right text-[11px] text-muted"
        />
      </div>
    </li>
  );
}

function Panel({
  title,
  hint,
  href,
  hrefLabel,
  tickets,
  empty,
}: {
  title: string;
  hint?: string;
  href: string;
  hrefLabel: string;
  tickets: TicketSummary[];
  empty: string;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {title}
          </h2>
          {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
        </div>
        <Link href={href} className="btn btn-ghost btn-sm">
          {hrefLabel}
        </Link>
      </div>

      {tickets.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {tickets.map((ticket) => (
            <CompactRow key={ticket.id} ticket={ticket} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Role-aware overview. One render, four cheap aggregate queries, no client
 * JavaScript beyond the theme toggle in the header.
 */
export async function Dashboard() {
  const user = await requireUser();
  const staff = isStaff(user.role);
  const stats = getStats(user);

  const attentionFilters: TicketFilters = {
    ...DEFAULT_FILTERS,
    status: "active",
    assignee: staff ? "me" : "any",
  };
  const attention = listTickets(user, attentionFilters, 5);
  const recent = listTickets(user, DEFAULT_FILTERS, 6);

  const stats_list: Stat[] = staff
    ? [
        { label: "Open", value: stats.open, href: "/tickets?status=open" },
        {
          label: "In progress",
          value: stats.inProgress,
          href: "/tickets?status=in_progress",
        },
        {
          label: "Awaiting reply",
          value: stats.awaitingAgent,
          href: "/tickets?status=active",
        },
        {
          label: "Unassigned",
          value: stats.unassigned,
          href: "/tickets?assignee=unassigned",
          emphasis: true,
        },
      ]
    : [
        { label: "Open", value: stats.open, href: "/tickets?status=open" },
        {
          label: "In progress",
          value: stats.inProgress,
          href: "/tickets?status=in_progress",
        },
        {
          label: "Waiting on you",
          value: stats.waiting,
          href: "/tickets?status=waiting",
        },
        {
          label: "Resolved (7d)",
          value: stats.resolvedRecent,
          href: "/tickets?status=resolved",
        },
      ];

  const summary = staff
    ? stats.awaitingAgent > 0
      ? `${stats.awaitingAgent} ticket${stats.awaitingAgent === 1 ? "" : "s"} awaiting a reply from the team.`
      : "Nothing is waiting on a reply right now."
    : stats.open + stats.inProgress > 0
      ? `${stats.open + stats.inProgress} of your tickets are being worked on.`
      : "You have no open tickets.";

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">{summary}</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats_list.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={staff ? "Assigned to you" : "Your active tickets"}
          hint={
            staff
              ? "Open work in your name, most recently updated first"
              : undefined
          }
          href={staff ? "/tickets?assignee=me&status=active" : "/tickets?status=active"}
          hrefLabel="View all"
          tickets={attention.tickets}
          empty={
            staff
              ? "Nothing assigned to you. Claim something from the unassigned queue."
              : "No active tickets. Create one if you need help."
          }
        />

        <Panel
          title="Recently updated"
          hint="Latest activity across every ticket you can see"
          href="/tickets"
          hrefLabel="All tickets"
          tickets={recent.tickets}
          empty="No tickets yet."
        />
      </div>
    </div>
  );
}
