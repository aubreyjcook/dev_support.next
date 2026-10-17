import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/action-button";
import { ActivityTimeline } from "@/components/activity-timeline";
import { CategoryBadge, PriorityBadge, StatusBadge } from "@/components/badges";
import { ReplyForm } from "@/components/reply-form";
import { TicketProperties } from "@/components/ticket-properties";
import { TicketThread } from "@/components/ticket-thread";
import { Time } from "@/components/time";
import { setOwnTicketStatusAction } from "@/lib/actions/tickets";
import { requireUser } from "@/lib/auth";
import { isStaff, type Role } from "@/lib/constants";
import {
  getTicketDetail,
  listEvents,
  listMessages,
  type TicketDetail,
} from "@/lib/tickets";
import { listAssignableUsers } from "@/lib/users";

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <span className="text-[11px] text-foreground">{children}</span>
    </div>
  );
}

function TicketMeta({ ticket }: { ticket: TicketDetail }) {
  return (
    <section aria-labelledby="meta-heading" className="card overflow-hidden">
      <h2
        id="meta-heading"
        className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted"
      >
        Details
      </h2>
      <div className="divide-y divide-line">
        <MetaRow label="Requester">{ticket.requester.name}</MetaRow>
        <MetaRow label="Opened">
          <Time value={ticket.createdAt} />
        </MetaRow>
        <MetaRow label="Updated">
          <Time value={ticket.updatedAt} />
        </MetaRow>
        {ticket.resolvedAt ? (
          <MetaRow label="Resolved">
            <Time value={ticket.resolvedAt} />
          </MetaRow>
        ) : null}
      </div>
    </section>
  );
}

function ReadOnlyProperties({ ticket }: { ticket: TicketDetail }) {
  return (
    <section aria-labelledby="props-heading" className="card overflow-hidden">
      <h2
        id="props-heading"
        className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted"
      >
        Properties
      </h2>
      <div className="divide-y divide-line">
        <MetaRow label="Status">
          <StatusBadge status={ticket.status} short />
        </MetaRow>
        <MetaRow label="Priority">
          <PriorityBadge priority={ticket.priority} />
        </MetaRow>
        <MetaRow label="Category">
          <CategoryBadge category={ticket.category} />
        </MetaRow>
        <MetaRow label="Assignee">{ticket.assignee?.name ?? "Unassigned"}</MetaRow>
      </div>
    </section>
  );
}

function RequesterActions({ ticket }: { ticket: TicketDetail }) {
  const finished = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {finished ? (
        <ActionButton
          action={setOwnTicketStatusAction}
          fields={{ ticketId: ticket.id, value: "open" }}
          label="Reopen ticket"
          pendingLabel="Reopening…"
        />
      ) : (
        <ActionButton
          action={setOwnTicketStatusAction}
          fields={{ ticketId: ticket.id, value: "closed" }}
          label="Mark as resolved"
          pendingLabel="Closing…"
        />
      )}
    </div>
  );
}

/**
 * Full ticket view. Resolves `params` itself so the page above can stay a
 * static shell — see `docs/architecture.md` -> "Rendering model".
 */
export async function TicketView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const ticketId = Number(id);
  if (!Number.isSafeInteger(ticketId) || ticketId <= 0) notFound();

  // Scoped read: renders 404 for tickets the viewer cannot access.
  const ticket = getTicketDetail(ticketId, user);
  if (!ticket) notFound();

  const messages = listMessages(ticketId, user);
  const events = listEvents(ticketId);
  const staff = isStaff(user.role);
  const assignable = staff ? listAssignableUsers() : [];
  const requesterRole: Role = "requester";

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <Link href="/tickets" className="hover:text-foreground">
            ← All tickets
          </Link>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{ticket.ref}</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-snug">{ticket.subject}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <CategoryBadge category={ticket.category} />
              <span className="text-[11px] text-muted">
                opened by {ticket.requester.name} <Time value={ticket.createdAt} />
              </span>
            </div>
          </div>

          {!staff ? <RequesterActions ticket={ticket} /> : null}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="order-2 space-y-3 lg:order-1">
          <TicketThread
            description={ticket.description}
            requester={{ name: ticket.requester.name, role: requesterRole }}
            createdAt={ticket.createdAt}
            messages={messages}
          />
          <ReplyForm ticketId={ticket.id} isStaff={staff} />
        </div>

        <aside className="order-1 space-y-3 lg:order-2">
          {staff ? (
            <TicketProperties ticket={ticket} assignable={assignable} />
          ) : (
            <ReadOnlyProperties ticket={ticket} />
          )}
          <TicketMeta ticket={ticket} />
          <ActivityTimeline events={events} />
        </aside>
      </div>
    </div>
  );
}
