import Link from "next/link";

import { AwaitingDot, PriorityBadge, StatusBadge } from "@/components/badges";
import { Time } from "@/components/time";
import { pluralize } from "@/lib/format";
import type { TicketSummary } from "@/lib/tickets";

/**
 * Dense, scannable ticket table. Server-rendered: one query, no client state.
 * Secondary columns collapse on narrow screens so the subject stays readable.
 */
export function TicketList({
  tickets,
  emptyHint,
  emptyAction,
}: {
  tickets: TicketSummary[];
  emptyHint: string;
  emptyAction?: { href: string; label: string };
}) {
  if (tickets.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="text-sm font-medium">No tickets to show</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{emptyHint}</p>
        {emptyAction ? (
          <Link href={emptyAction.href} className="btn btn-primary btn-sm mt-4">
            {emptyAction.label}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] border-collapse text-left text-[13px]">
          <caption className="sr-only">
            {pluralize(tickets.length, "ticket")} sorted by most recent activity
          </caption>
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              <th scope="col" className="py-2 pl-4 pr-3 font-medium">
                Ref
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Subject
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Status
              </th>
              <th scope="col" className="hidden py-2 pr-3 font-medium md:table-cell">
                Priority
              </th>
              <th scope="col" className="hidden py-2 pr-3 font-medium sm:table-cell">
                Assignee
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr
                key={ticket.id}
                className="border-t border-line align-middle transition-colors hover:bg-surface-muted/70"
              >
                <td className="whitespace-nowrap py-2.5 pl-4 pr-3 font-mono text-[11px] text-muted">
                  {ticket.ref}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    {ticket.awaitingAgent ? <AwaitingDot /> : null}
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="line-clamp-2 font-medium hover:text-accent"
                    >
                      {ticket.subject}
                    </Link>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {ticket.requesterName}
                    {ticket.messageCount > 0
                      ? ` · ${pluralize(ticket.messageCount, "reply", "replies")}`
                      : " · no replies yet"}
                  </div>
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3">
                  <StatusBadge status={ticket.status} short />
                </td>
                <td className="hidden whitespace-nowrap py-2.5 pr-3 md:table-cell">
                  <PriorityBadge priority={ticket.priority} />
                </td>
                <td className="hidden whitespace-nowrap py-2.5 pr-3 text-xs text-muted sm:table-cell">
                  {ticket.assigneeName ?? "Unassigned"}
                </td>
                <td className="whitespace-nowrap py-2.5 pr-4 text-right text-[11px] text-muted">
                  <Time value={ticket.updatedAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
