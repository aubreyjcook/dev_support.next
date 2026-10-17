import { AutoSubmitForm } from "@/components/auto-submit-form";
import { AssignToMeButton } from "@/components/assign-to-me";
import { setTicketFieldAction } from "@/lib/actions/tickets";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUSES,
} from "@/lib/constants";
import type { TicketDetail } from "@/lib/tickets";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <div className="w-40 shrink-0">{children}</div>
    </div>
  );
}

/**
 * Inline ticket properties. Each control writes through immediately on change
 * (staff only) — no "Save" button, no page reload.
 */
export function TicketProperties({
  ticket,
  assignable,
}: {
  ticket: TicketDetail;
  assignable: { id: number; name: string }[];
}) {
  return (
    <section aria-labelledby="properties-heading" className="card overflow-hidden">
      <h2
        id="properties-heading"
        className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted"
      >
        Properties
      </h2>

      <div className="divide-y divide-line">
        <Row label="Status">
          <AutoSubmitForm
            action={setTicketFieldAction}
            hiddenFields={{ ticketId: ticket.id, field: "status" }}
          >
            <select
              name="value"
              defaultValue={ticket.status}
              aria-label="Status"
              className="input input-sm"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </AutoSubmitForm>
        </Row>

        <Row label="Priority">
          <AutoSubmitForm
            action={setTicketFieldAction}
            hiddenFields={{ ticketId: ticket.id, field: "priority" }}
          >
            <select
              name="value"
              defaultValue={ticket.priority}
              aria-label="Priority"
              className="input input-sm"
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABEL[priority]}
                </option>
              ))}
            </select>
          </AutoSubmitForm>
        </Row>

        <Row label="Assignee">
          <AutoSubmitForm
            action={setTicketFieldAction}
            hiddenFields={{ ticketId: ticket.id, field: "assignee" }}
          >
            <select
              name="value"
              defaultValue={ticket.assignee?.id ?? ""}
              aria-label="Assignee"
              className="input input-sm"
            >
              <option value="">Unassigned</option>
              {assignable.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </AutoSubmitForm>
        </Row>

        <Row label="Category">
          <AutoSubmitForm
            action={setTicketFieldAction}
            hiddenFields={{ ticketId: ticket.id, field: "category" }}
          >
            <select
              name="value"
              defaultValue={ticket.category}
              aria-label="Category"
              className="input input-sm"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
          </AutoSubmitForm>
        </Row>
      </div>

      <div className="border-t border-line p-2">
        <AssignToMeButton ticketId={ticket.id} />
      </div>
    </section>
  );
}
