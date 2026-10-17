import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { TicketFiltersForm } from "@/components/ticket-filters";
import { TicketList } from "@/components/ticket-list";
import { requireUser } from "@/lib/auth";
import { isStaff } from "@/lib/constants";
import {
  filterSignature,
  hasActiveFilters,
  parseTicketFilters,
} from "@/lib/filters";
import { listTickets } from "@/lib/tickets";

export const metadata: Metadata = {
  title: "Tickets",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="skeleton h-8 w-full max-w-md" />
      <div className="skeleton h-4 w-24" />
      <div className="card overflow-hidden">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="skeleton mx-4 my-2 h-9" />
        ))}
      </div>
    </div>
  );
}

/** Reads the session + search params, so it streams inside its own boundary. */
async function TicketsPanel({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const filters = parseTicketFilters(await searchParams);
  const staff = isStaff(user.role);
  const { tickets, total, limited } = listTickets(user, filters);
  const filtered = hasActiveFilters(filters);

  return (
    <div className="group space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TicketFiltersForm
          // Remounts when the URL changes from elsewhere (e.g. "Clear filters")
          // so the uncontrolled controls re-read their defaults.
          key={filterSignature(filters)}
          basePath="/tickets"
          filters={filters}
          showAssignee={staff}
        />

        {filtered ? (
          <Link href="/tickets" className="btn btn-ghost btn-sm">
            Clear filters
          </Link>
        ) : null}
      </div>

      <p aria-live="polite" className="text-[11px] text-muted">
        {total === 1 ? "1 ticket" : `${total} tickets`}
        {filters.q ? ` matching “${filters.q}”` : ""}
        {limited ? " · showing the first 100" : ""}
      </p>

      <div className="group-has-data-pending:opacity-60">
        <TicketList
          tickets={tickets}
          emptyHint={
            filtered
              ? "No ticket matches these filters. Try clearing them."
              : staff
                ? "Nobody has asked for help yet."
                : "You have not opened any tickets yet."
          }
          emptyAction={{ href: "/tickets/new", label: "New ticket" }}
        />
      </div>
    </div>
  );
}

export default function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tickets</h1>
          <p className="text-xs text-muted">
            Search, filter, and open a ticket to see its full history.
          </p>
        </div>
        <Link href="/tickets/new" className="btn btn-primary btn-sm">
          New ticket
        </Link>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <TicketsPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
