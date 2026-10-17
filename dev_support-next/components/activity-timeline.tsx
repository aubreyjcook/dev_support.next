import { Time } from "@/components/time";
import type { TicketEvent } from "@/lib/tickets";

const TYPE_COLOR: Record<string, string> = {
  created: "bg-[var(--tone-blue)]",
  status: "bg-[var(--tone-emerald)]",
  priority: "bg-[var(--tone-amber)]",
  assignee: "bg-[var(--tone-violet)]",
  category: "bg-[var(--tone-zinc)]",
};

/**
 * Audit trail for a ticket. Every write in `lib/tickets.ts` appends an event,
 * so this is the authoritative "what happened and when" record.
 */
export function ActivityTimeline({ events }: { events: TicketEvent[] }) {
  return (
    <section aria-labelledby="activity-heading" className="card overflow-hidden">
      <h2
        id="activity-heading"
        className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted"
      >
        Activity
      </h2>

      {events.length === 0 ? (
        <p className="px-3 py-3 text-[11px] text-muted">No recorded activity.</p>
      ) : (
        <ol className="space-y-2.5 px-3 py-3">
          {events.map((event) => (
            <li key={event.id} className="flex gap-2">
              <span
                aria-hidden="true"
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                  TYPE_COLOR[event.type] ?? "bg-[var(--tone-zinc)]"
                }`}
              />
              <div className="min-w-0 text-[11px] leading-snug text-muted">
                <span className="font-medium text-foreground">
                  {event.actorName ?? "System"}
                </span>{" "}
                {event.detail}
                <div className="text-[10px] text-muted">
                  <Time value={event.createdAt} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
